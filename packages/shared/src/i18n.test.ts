/**
 * The locale core.
 *
 *   node --experimental-strip-types --test packages/shared/src/i18n.test.ts
 *
 * These cover the four things that are genuinely hard and silently wrong if you
 * get them subtly off: plural selection in a language with more than two forms,
 * SMS segment cost once the alphabet leaves GSM-7, resolving a Schedule LEP code
 * we cannot honor, and assembling an RTL sentence around Latin content.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { renderEmail, renderSms, type ChaseCopyInput } from './chase.ts';
import {
  DICTIONARIES,
  FSI,
  LEP_CANCEL_CODE,
  LOCALES,
  LOCALE_IDS,
  PDI,
  RLM,
  TONES,
  directionOf,
  docCodeLabel,
  formatList,
  isLocaleId,
  isolate,
  localeRecord,
  lepCodeForLanguage,
  plural,
  preferLanguage,
  effectiveLocale,
  multilingualEnabled,
  resolveLepCode,
  smsCost,
  stripBidi,
  t,
  type ClientLanguage,
  type LocaleId,
} from './i18n/index.ts';

/** One realistic client, used everywhere so numbers are comparable. */
const FIXTURE: ChaseCopyInput = {
  clientFirstName: 'Eleanor',
  firmName: 'Whitfield & Rowe',
  preparerName: 'Ava Okonkwo',
  outstanding: ['W-2', 'Form 1098', '1099-DIV', '1099-B'],
  outstandingCount: 4,
  totalCount: 11,
  portalUrl: 'https://taxfax.xyz/p/abc123',
  daysWaiting: 9,
  daysToDeadline: 26,
  signature: 'Ava Okonkwo · Whitfield & Rowe',
};

const at = (locale: LocaleId): ChaseCopyInput => ({ ...FIXTURE, locale });

// ── Plurals ──────────────────────────────────────────────────────────────────

describe('plurals', () => {
  it('picks all four Russian forms', () => {
    const document = DICTIONARIES.ru.plural.document!;
    // one / few / many / one again at 21 — the standard Slavic trap.
    assert.equal(plural('ru', 1, document), 'документ');
    assert.equal(plural('ru', 3, document), 'документа');
    assert.equal(plural('ru', 5, document), 'документов');
    assert.equal(plural('ru', 11, document), 'документов');
    assert.equal(plural('ru', 21, document), 'документ');
    assert.equal(plural('ru', 22, document), 'документа');
    assert.equal(plural('ru', 25, document), 'документов');
    assert.equal(plural('ru', 101, document), 'документ');

    const day = DICTIONARIES.ru.plural.day!;
    assert.equal(plural('ru', 1, day), 'день');
    assert.equal(plural('ru', 2, day), 'дня');
    assert.equal(plural('ru', 9, day), 'дней');
  });

  it('picks all six Arabic forms, dual included', () => {
    const document = DICTIONARIES.ar.plural.document!;
    assert.equal(plural('ar', 0, document), 'مستند'); // zero
    assert.equal(plural('ar', 1, document), 'مستند'); // one
    assert.equal(plural('ar', 2, document), 'مستندان'); // two — the dual
    assert.equal(plural('ar', 3, document), 'مستندات'); // few
    assert.equal(plural('ar', 10, document), 'مستندات');
    assert.equal(plural('ar', 11, document), 'مستندًا'); // many
    assert.equal(plural('ar', 99, document), 'مستندًا');
    assert.equal(plural('ar', 100, document), 'مستند'); // other
  });

  it('every dictionary fills every category its language actually selects', () => {
    for (const id of LOCALE_IDS) {
      const rules = new Intl.PluralRules(LOCALES[id].bcp47);
      const used = new Set<Intl.LDMLPluralRule>();
      for (let n = 0; n <= 200; n++) used.add(rules.select(n));
      for (const [name, forms] of Object.entries(DICTIONARIES[id].plural)) {
        const filled: Partial<Record<Intl.LDMLPluralRule, string>> = forms;
        for (const cat of used) {
          assert.ok(filled[cat], `${id}.plural.${name} has no "${cat}" form`);
        }
      }
    }
  });

  it('the counted noun actually changes inside a rendered message', () => {
    const one = renderEmail('firm', { ...at('ru'), daysWaiting: 1 }).body;
    const few = renderEmail('firm', { ...at('ru'), daysWaiting: 3 }).body;
    const many = renderEmail('firm', { ...at('ru'), daysWaiting: 9 }).body;
    assert.ok(one.includes('1 день'), one);
    assert.ok(few.includes('3 дня'), few);
    assert.ok(many.includes('9 дней'), many);
  });

  it('does not say "1 days" in English', () => {
    const body = renderEmail('firm', { ...FIXTURE, daysWaiting: 1 }).body;
    assert.ok(body.includes('1 day'), body);
    assert.ok(!body.includes('1 days'), body);
  });
});

// ── SMS cost ─────────────────────────────────────────────────────────────────

describe('sms segmentation', () => {
  it('counts GSM-7 and UCS-2 the way a carrier bills them', () => {
    assert.deepEqual(smsCost('hello'), { encoding: 'gsm7', units: 5, segments: 1, remaining: 155 });
    assert.equal(smsCost('a'.repeat(160)).segments, 1);
    assert.equal(smsCost('a'.repeat(161)).segments, 2);
    // Braces cost two septets each: an escape plus the character.
    assert.equal(smsCost('{}').units, 4);
    // One non-GSM-7 character drags the whole message to UCS-2 at 70/segment.
    assert.equal(smsCost('a'.repeat(80)).encoding, 'gsm7');
    assert.equal(smsCost('a'.repeat(80) + '—').encoding, 'ucs2');
    assert.equal(smsCost('a'.repeat(80) + '—').segments, 2);
    // An emoji is a surrogate pair: two units, and a carrier will not split it
    // across a segment boundary. 134 units would be exactly two segments if you
    // divided; because the pair straddles the seam it costs three.
    assert.equal(smsCost('😀').units, 2);
    assert.equal(smsCost('a'.repeat(66) + '😀' + 'a'.repeat(66)).units, 134);
    assert.equal(smsCost('a'.repeat(66) + '😀' + 'a'.repeat(66)).segments, 3);
  });

  it('keeps every non-English chase text inside two segments', () => {
    for (const id of LOCALE_IDS) {
      if (id === 'en') continue;
      for (const tone of TONES) {
        const cost = smsCost(renderSms(tone, at(id)));
        assert.ok(cost.segments <= 2, `${id}/${tone}: ${cost.segments} segments (${cost.units})`);
      }
    }
  });

  it('English is UCS-2 today only because of the em dash', () => {
    // Documented, not accepted: swapping "—" for "-" in the English copy drops
    // every English chase text from UCS-2 (70/segment) to GSM-7 (160/segment).
    const sms = renderSms('urgent', FIXTURE);
    assert.equal(smsCost(sms).encoding, 'ucs2');
    assert.equal(smsCost(sms.replace('—', '-')).encoding, 'gsm7');
    assert.ok(smsCost(sms.replace('—', '-')).segments < smsCost(sms).segments);
  });

  it('every locale keeps the opt-out keyword and the portal link', () => {
    for (const id of LOCALE_IDS) {
      for (const tone of TONES) {
        const sms = renderSms(tone, at(id));
        assert.ok(sms.includes('STOP'), `${id}/${tone} dropped STOP`);
        assert.ok(sms.includes(FIXTURE.portalUrl), `${id}/${tone} dropped the link`);
      }
    }
  });
});

// ── Schedule LEP ─────────────────────────────────────────────────────────────

describe('schedule LEP resolution', () => {
  it('resolves a code we can write', () => {
    const out = resolveLepCode('003');
    assert.equal(out.kind, 'supported');
    assert.equal(out.locale, 'vi');
    assert.equal(out.language, 'Vietnamese');
  });

  it('resolves every code the form actually lists', () => {
    for (let n = 0; n <= 20; n++) {
      const out = resolveLepCode(String(n).padStart(3, '0'));
      assert.notEqual(out.kind, 'unknown', `code ${n} is on the form`);
      assert.ok(isLocaleId(out.locale));
    }
  });

  it('flags a real IRS language we have no dictionary for — never a silent fallback', () => {
    const khmer = resolveLepCode('015');
    assert.equal(khmer.kind, 'unsupported');
    assert.equal(khmer.language, 'Khmer');
    assert.equal(khmer.locale, 'en'); // we still write English…
    assert.notEqual(khmer.kind, 'supported'); // …but the firm is told why.

    for (const code of ['009', '010', '011', '012', '013', '014', '016', '017', '018']) {
      assert.equal(resolveLepCode(code).kind, 'unsupported', code);
    }
  });

  it('treats a code that is not on the form as no election at all', () => {
    for (const bad of ['999', '021', 'abc', '', '  ', '00x']) {
      const out = resolveLepCode(bad);
      assert.equal(out.kind, 'unknown', `"${bad}" is not an election`);
      assert.equal(out.locale, 'en');
    }
  });

  it('a missing code is unknown, not a cancellation', () => {
    // The trap: padding "" to three digits yields "000", which on the form means
    // "cancel my election". Absence of evidence is not an election.
    assert.equal(resolveLepCode(undefined).kind, 'unknown');
    assert.equal(resolveLepCode(null).kind, 'unknown');
    assert.equal(resolveLepCode(LEP_CANCEL_CODE).kind, 'supported');
    assert.equal(resolveLepCode(LEP_CANCEL_CODE).locale, 'en');
  });

  it('pads a short code the way tax software prints it', () => {
    assert.equal(resolveLepCode('3').locale, 'vi');
    assert.equal(resolveLepCode(' 20 ').locale, 'zh-Hans');
  });

  it('maps the IRS language names back to codes', () => {
    assert.equal(lepCodeForLanguage('Haitian Creole'), '006');
    assert.equal(lepCodeForLanguage('chinese (traditional)'), '019');
    assert.equal(lepCodeForLanguage('Klingon'), undefined);
  });
});

// ── Language precedence ──────────────────────────────────────────────────────

describe('language precedence', () => {
  const detected = (locale: LocaleId, lepCode: string): ClientLanguage => ({
    locale,
    source: 'detected',
    lepCode,
  });

  it('a human choice beats a detection', () => {
    const preparer: ClientLanguage = { locale: 'es', source: 'preparer' };
    const merged = preferLanguage(preparer, detected('vi', '003'));
    assert.equal(merged?.locale, 'es', 'the detection must not overwrite the preparer');
  });

  it('but the rejected detection still leaves its evidence behind', () => {
    const preparer: ClientLanguage = { locale: 'es', source: 'preparer' };
    const merged = preferLanguage(preparer, detected('vi', '003'));
    assert.equal(merged?.lepCode, '003', 'the firm must be able to see what the IRS was told');
    assert.equal(merged?.source, 'preparer');
  });

  it('re-detecting the same thing is a no-op', () => {
    const onFile: ClientLanguage = { locale: 'es', source: 'preparer', lepCode: '003' };
    assert.equal(preferLanguage(onFile, detected('vi', '003')), null);
  });

  it('the taxpayer outranks everyone', () => {
    const preparer: ClientLanguage = { locale: 'es', source: 'preparer' };
    const taxpayer: ClientLanguage = { locale: 'ko', source: 'taxpayer' };
    assert.equal(preferLanguage(preparer, taxpayer)?.locale, 'ko');
    assert.equal(preferLanguage(taxpayer, { locale: 'es', source: 'preparer' }), null);
    assert.equal(preferLanguage(taxpayer, { locale: 'ru', source: 'taxpayer' })?.locale, 'ru');
  });

  it('a detection wins over the firm default', () => {
    const fallback: ClientLanguage = { locale: 'en', source: 'default' };
    assert.equal(preferLanguage(fallback, detected('ru', '004'))?.locale, 'ru');
    assert.equal(preferLanguage(undefined, detected('ru', '004'))?.locale, 'ru');
  });

  it('an unsupported election is recorded rather than resolved away', () => {
    const next: ClientLanguage = {
      locale: 'en',
      source: 'detected',
      lepCode: '015',
      unsupported: { code: '015', language: 'Khmer' },
    };
    const merged = preferLanguage({ locale: 'es', source: 'preparer' }, next);
    assert.equal(merged?.locale, 'es');
    assert.deepEqual(merged?.unsupported, { code: '015', language: 'Khmer' });
  });

  it('a firm can switch the whole thing off without touching client data', () => {
    const language: ClientLanguage = { locale: 'ko', source: 'taxpayer' };
    assert.equal(effectiveLocale(language, multilingualEnabled(undefined)), 'ko');
    assert.equal(effectiveLocale(language, multilingualEnabled({})), 'ko');
    assert.equal(effectiveLocale(language, multilingualEnabled({ multilingual: { enabled: true } })), 'ko');
    assert.equal(
      effectiveLocale(language, multilingualEnabled({ multilingual: { enabled: false } })),
      'en',
    );
  });

  it('never resolves to a locale we cannot write', () => {
    assert.equal(effectiveLocale(undefined), 'en');
    assert.equal(effectiveLocale({ locale: 'xx' as LocaleId, source: 'preparer' }), 'en');
  });
});

// ── RTL and bidi ─────────────────────────────────────────────────────────────

describe('rtl assembly', () => {
  it('marks direction on the locale record', () => {
    assert.equal(directionOf('ar'), 'rtl');
    for (const id of LOCALE_IDS) {
      if (id !== 'ar') assert.equal(directionOf(id), 'ltr', id);
    }
  });

  it('isolates LTR content spliced into an RTL sentence', () => {
    assert.equal(isolate('1099-DIV', 'rtl'), `${FSI}1099-DIV${PDI}`);
    assert.equal(isolate('Whitfield & Rowe', 'rtl'), `${FSI}Whitfield & Rowe${PDI}`);
    // Arabic inside Arabic needs no isolate, and four wasted UTF-16 units are
    // four fewer characters of SMS.
    assert.equal(isolate('مرحبًا', 'rtl'), 'مرحبًا');
    // Bare digits are resolved correctly by the bidi algorithm on their own.
    assert.equal(isolate('26', 'rtl'), '26');
  });

  it('never isolates in an LTR locale', () => {
    assert.equal(isolate('1099-DIV', 'ltr'), '1099-DIV');
    assert.equal(isolate('مرحبًا', 'ltr'), 'مرحبًا');
  });

  it('wraps every inline Latin run in a rendered Arabic email', () => {
    const { body } = renderEmail('urgent', at('ar'));
    assert.ok(body.includes(`${FSI}${FIXTURE.portalUrl}${PDI}`), body);
    assert.ok(body.includes(`${FSI}Eleanor${PDI}`), body);
    // The subject splices a form code mid-sentence, which is the case that
    // renders scrambled without an isolate.
    const subject = renderEmail('firm', at('ar')).subject;
    assert.ok(subject.includes(`${FSI}W-2`), subject);
    assert.ok(subject.endsWith(PDI) || subject.includes(PDI), subject);
    // Isolates must be balanced, or a mail client renders the rest of the note
    // in the wrong direction.
    assert.equal(
      (body.match(/\u2068/g) ?? []).length,
      (body.match(/\u2069/g) ?? []).length,
      'unbalanced FSI/PDI',
    );
    // …and never across a line break, where an isolate does not survive.
    for (const line of body.split('\n')) {
      assert.equal(
        (line.match(/\u2068/g) ?? []).length,
        (line.match(/\u2069/g) ?? []).length,
        `unbalanced isolate on line: ${line}`,
      );
    }
  });

  it('pins RTL bullet lines with an RLM', () => {
    const body = renderEmail('neutral', at('ar')).body;
    assert.ok(body.includes(`${RLM}  •  `), 'a bullet leads with a neutral and needs the mark');
    assert.ok(!renderEmail('neutral', at('es')).body.includes(RLM), 'LTR needs no mark');
  });

  it('leaves English free of every bidi control', () => {
    for (const tone of TONES) {
      const { subject, body } = renderEmail(tone, FIXTURE);
      const all = subject + body + renderSms(tone, FIXTURE);
      assert.equal(stripBidi(all), all, `${tone} smuggled a bidi control into English`);
    }
  });
});

// ── Lists, dates, labels ─────────────────────────────────────────────────────

describe('formatting', () => {
  it('uses house style for English lists — no Oxford comma', () => {
    assert.equal(formatList('en', ['W-2', 'Form 1098', '1099-DIV']), 'W-2, Form 1098 and 1099-DIV');
    assert.equal(formatList('en', ['W-2', 'Form 1098']), 'W-2 and Form 1098');
    assert.equal(formatList('en', ['W-2']), 'W-2');
    assert.equal(formatList('en', []), '');
  });

  it('joins Haitian Creole by hand because CLDR has no data for it', () => {
    // `Intl.ListFormat('ht')` silently resolves to English and would emit "and".
    assert.equal(formatList('ht', ['W-2', '1099-DIV']), 'W-2 ak 1099-DIV');
    assert.equal(formatList('ht', ['W-2', 'Form 1098', '1099-DIV']), 'W-2, Form 1098 ak 1099-DIV');
  });

  it('uses the native conjunction elsewhere', () => {
    assert.ok(formatList('es', ['W-2', '1099-DIV']).includes(' y '));
    assert.ok(formatList('ru', ['W-2', '1099-DIV']).includes(' и '));
    assert.equal(formatList('ja' as LocaleId, ['a', 'b']), 'a and b'); // unknown → English
  });

  it('translates plain-English document descriptors but never an IRS form code', () => {
    assert.equal(docCodeLabel('en', 'mileage-log', 'x'), DICTIONARIES.en.docCode['mileage-log']);
    assert.notEqual(docCodeLabel('es', 'mileage-log', 'x'), docCodeLabel('en', 'mileage-log', 'x'));
    assert.notEqual(docCodeLabel('ru', 'bank-statements', 'x'), docCodeLabel('en', 'bank-statements', 'x'));
    // A form identifier is what the taxpayer is holding. Translating "1099-DIV"
    // makes the paper harder to find, not easier — so it is not in the table and
    // falls straight through.
    assert.equal(docCodeLabel('ar', 'w2', 'W-2'), 'W-2');
    assert.equal(docCodeLabel('ko', '1099-div', '1099-DIV'), '1099-DIV');
  });

  it('every locale record is one Intl actually accepts', () => {
    for (const id of LOCALE_IDS) {
      const rec = localeRecord(id);
      assert.equal(Intl.getCanonicalLocales(rec.bcp47).length, 1, `${id}: ${rec.bcp47}`);
      assert.ok(rec.endonym.length > 0, `${id} needs an endonym for the portal picker`);
    }
    assert.equal(localeRecord('nonsense').id, 'en');
  });

  it('t() interpolates and falls back without throwing', () => {
    assert.equal(t('en', 'portal.upload'), DICTIONARIES.en.s['portal.upload']);
    assert.ok(t('es', 'portal.upload').length > 0);
    assert.ok(t('xx' as LocaleId, 'portal.upload').length > 0);
  });
});

// ── Honesty ──────────────────────────────────────────────────────────────────

describe('translation review status', () => {
  it('marks exactly one locale as the source and none as verified yet', () => {
    assert.equal(DICTIONARIES.en.review, 'source');
    for (const id of LOCALE_IDS) {
      if (id === 'en') continue;
      assert.equal(
        DICTIONARIES[id].review,
        'machine',
        `${id} claims review status it has not earned`,
      );
    }
  });
});

// ── The recognition line ─────────────────────────────────────────────────────

/**
 * `Got it — W-2 from Acme Corp.` is the single most important sentence in the
 * product for a taxpayer who does not read English: it is the moment they find
 * out whether the photo they just took actually worked. Three forms, because we
 * know three different amounts about the file.
 */
describe('post-upload recognition line', () => {
  it('never translates the IRS form code or the issuer name', () => {
    for (const id of LOCALE_IDS) {
      const line = t(id, 'upload.gotItIssuer', { code: '1099-DIV', issuer: 'Vanguard' });
      assert.ok(line.includes('1099-DIV'), `${id} lost the form code`);
      assert.ok(line.includes('Vanguard'), `${id} lost the issuer`);
      assert.ok(!/\{\w+\}/.test(line), `${id} left a slot unrendered: ${line}`);
    }
  });

  it('isolates both Latin runs in Arabic and neither anywhere else', () => {
    const ar = t('ar', 'upload.gotItIssuer', { code: 'W-2', issuer: 'Acme Corp' });
    assert.ok(ar.includes(FSI + 'W-2' + PDI), 'the form code must be isolated');
    assert.ok(ar.includes(FSI + 'Acme Corp' + PDI), 'the issuer must be isolated');
    // Strip the controls and the Arabic sentence is intact around the Latin.
    assert.equal(stripBidi(ar), 'وصلنا — W-2 من Acme Corp.');

    for (const id of LOCALE_IDS) {
      if (localeRecord(id).dir === 'rtl') continue;
      const line = t(id, 'upload.gotItIssuer', { code: 'W-2', issuer: 'Acme Corp' });
      assert.equal(stripBidi(line), line, `${id} is LTR and needs no bidi controls`);
    }
  });

  it('keeps a filename readable inside an RTL aria-label', () => {
    const label = t('ar', 'upload.undoLabel', { name: 'W2_Acme_2024.pdf' });
    assert.ok(label.includes(FSI + 'W2_Acme_2024.pdf' + PDI), 'the filename must not be reordered');
  });

  it('has all three forms in every locale, and the codeless one takes no slots', () => {
    for (const id of LOCALE_IDS) {
      for (const key of ['upload.gotItIssuer', 'upload.gotItCode', 'upload.gotItSaved'] as const) {
        assert.ok(DICTIONARIES[id].s[key]?.length, `${id} is missing ${key}`);
      }
      assert.ok(
        !/\{\w+\}/.test(DICTIONARIES[id].s['upload.gotItSaved']),
        `${id}: the no-classification form has nothing to interpolate`,
      );
      assert.ok(
        DICTIONARIES[id].s['upload.gotItCode'].includes('{code}'),
        `${id}: the code-only form must still carry the code`,
      );
    }
  });

  it('does not let a translation drop or invent an interpolation slot', () => {
    const slots = (s: string) => new Set(Array.from(s.matchAll(/\{(\w+)(?:#\w+)?\}/g), (m) => m[1]));
    for (const key of Object.keys(DICTIONARIES.en.s) as (keyof typeof DICTIONARIES.en.s)[]) {
      for (const id of LOCALE_IDS) {
        assert.deepEqual(slots(DICTIONARIES[id].s[key]), slots(DICTIONARIES.en.s[key]), `${id}.${key}`);
      }
    }
  });
});
