/**
 * Self-check for the shared domain logic. `node --experimental-strip-types check.ts`
 * Deliberately assert-based and framework-free — it exists to fail loudly when
 * the checklist rules, cadence maths or canonical naming drift.
 */
import assert from 'node:assert/strict';
import { emptyPriorYear, generateChecklist, STARTER_CHECKLIST } from './checklist.ts';
import { canonicalName, clientToken, documentPath, parseDocumentPath, slugify } from './naming.ts';
import { cadenceCompression, nextSendableSlot, renderEmail, renderSms, stepDueAt } from './chase.ts';
import { CHASE_PROFILES } from './chase.ts';
import { DOC_TYPES, docType } from './taxonomy.ts';
import { requestSatisfied, requestSatisfiedWith, type RequestStatus } from './models.ts';
import { isE164, isEmail, normEmail, normPhone } from './contact.ts';
import {
  DESCRIPTOR_DOC_TYPE_IDS,
  DICTIONARIES,
  LEP_LANGUAGES,
  LOCALES,
  LOCALE_IDS,
  REASON_CODES,
  REASON_KEYS,
  TONES,
  isLocaleId,
  localeRecord,
  recoverReason,
  renderReason,
  requestReason,
  resolveClientLocale,
  resolveLepCode,
  smsCost,
  t,
  type LocaleId,
  type ReasonKey,
  type StringKey,
} from './i18n/index.ts';

// ── Taxonomy ────────────────────────────────────────────────────────────────

{
  const ids = DOC_TYPES.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length, 'doc type ids must be unique');
  const slugs = DOC_TYPES.map((d) => d.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'doc type slugs must be unique');
  for (const d of DOC_TYPES) {
    assert.ok(d.label.length > 0 && d.hint.length > 0, `${d.id} needs a label and a taxpayer hint`);
    for (const p of [...d.match.strong, ...(d.match.weak ?? []), ...(d.match.veto ?? [])]) {
      new RegExp(p, 'i'); // throws on a malformed pattern
    }
  }
  // Every checklist rule and starter item must point at a real doc type.
  for (const s of STARTER_CHECKLIST) docType(s.docTypeId);

  // Matchers widen, they never swap. `match.strong` is compiled and run against
  // OCR'd document text, and a missing strong hit caps confidence below
  // auto-accept — so a pattern spelled only one way silently dumps real
  // documents into the review queue. The IRS says "acknowledgment" (Pub 1771)
  // and plenty of charities write "acknowledgement"; both must land. This is the
  // opposite of the rule for display strings below, which are en-US only.
  const charity = docType('charitable').match.strong.map((p) => new RegExp(p, 'i'));
  for (const spelling of ['acknowledgment of your gift', 'acknowledgement of your gift']) {
    assert.ok(
      charity.some((re) => re.test(`Thank you for your donation. This is our written ${spelling}.`)),
      `the charitable matcher no longer accepts "${spelling}" — it was narrowed, not widened`,
    );
  }
}

// ── Checklist generation ────────────────────────────────────────────────────

{
  // A wage earner with a mortgage, two kids and a brokerage account.
  const prior = emptyPriorYear(2024);
  prior.formType = '1040';
  prior.filingStatus = 'mfj';
  prior.dependents = 2;
  prior.state = 'CA';
  prior.itemized = true;
  prior.schedules = ['A', 'B', 'D'];
  prior.lines = { '1z': 184_000, '2b': 1_240, '3a': 890, '7': 12_500 };
  prior.documentCounts = { w2: 2, '1098': 1, '1099-div': 1, '1099-b': 1 };
  prior.issuers = [
    { docTypeId: 'w2', name: 'Acme Corp' },
    { docTypeId: 'w2', name: 'Northwind LLC' },
    { docTypeId: '1098', name: 'Wells Fargo' },
  ];
  prior.confidence = 0.94;

  const hits = generateChecklist({ prior, taxYear: 2025 });
  const byId = new Map(hits.map((h) => [h.docTypeId, h]));

  assert.ok(hits.length >= 6, 'a rich prior year should yield a substantial checklist');
  assert.equal(byId.get('w2')?.quantity, 2, 'two W-2s last year means two expected this year');
  assert.deepEqual(byId.get('w2')?.issuers, ['Acme Corp', 'Northwind LLC']);
  assert.match(byId.get('w2')!.reason, /Acme Corp/, 'the reason must name the actual employers');
  assert.ok(byId.has('1098'), 'an itemizer with a 1098 last year needs one again');
  assert.ok(byId.has('1099-div'), 'Schedule B dividends imply a 1099-DIV');

  // Every hit must be actionable: real doc type, positive quantity, a reason a
  // taxpayer can read.
  for (const h of hits) {
    docType(h.docTypeId);
    assert.ok(h.quantity > 0, `${h.docTypeId} quantity`);
    assert.ok(h.reason.length > 12 && /[.!]$/.test(h.reason), `${h.docTypeId} reason: ${h.reason}`);
  }
  assert.equal(new Set(hits.map((h) => h.docTypeId)).size, hits.length, 'no duplicate doc types');

  // An empty parse must not invent income documents — only the unconditional
  // engagement items every filer owes regardless of last year.
  const bare = generateChecklist({ prior: emptyPriorYear(2024), taxYear: 2025 });
  for (const h of bare) {
    const cat = docType(h.docTypeId).category;
    assert.ok(
      cat === 'admin' || cat === 'identity' || cat === 'property',
      `nothing in ${cat} should be invented without a prior-year signal (${h.docTypeId})`,
    );
  }
  assert.ok(!bare.some((h) => h.docTypeId === 'w2'), 'no W-2 without a wage signal');
}

{
  // A sole proprietor: Schedule C must pull business documents, not just wages.
  const prior = emptyPriorYear(2024);
  prior.formType = '1040';
  prior.entityType = 'individual';
  prior.schedules = ['C', 'SE'];
  prior.lines = { '8': 96_000 };
  prior.documentCounts = { '1099-nec': 3 };
  const ids = generateChecklist({ prior, taxYear: 2025 }).map((h) => h.docTypeId);
  assert.ok(ids.includes('1099-nec'), 'Schedule C filers need their 1099-NECs');
  assert.ok(!ids.includes('1098-t'), 'no tuition statement without a prior-year signal');
}

// ── en-US spelling ──────────────────────────────────────────────────────────

{
  // This is a US tax product and English is the source locale every translation
  // derives from, so one British spelling here propagates into all ten
  // dictionaries. A named list of the usual offenders, not a spell-checker.
  const EN_GB =
    /^(?:(?:itemis|organis|recognis|authoris|summaris|categoris|normalis|denormalis|utilis|minimis|maximis|prioritis|customis|optimis|standardis|specialis|apologis|criticis|localis|canonicalis|neutralis)(?:e|ed|es|ing|ation|ations)|analys(?:e|ed|ing)|(?:behaviour|colour|favour|honour|labour|neighbour|humour|rumour|endeavour)\w*|acknowledgement|totalling|cheques?|licences?|enrolment|instalment|fulfil|programme|labelled|travelling|modelling|defence|offence|pretence|centres?|metres?|whilst|amongst|judgement|practise|ageing|skilful|wilful)$/i;

  const clean = (where: string, text: string) => {
    for (const word of text.match(/[A-Za-z]+/g) ?? []) {
      if (EN_GB.test(word)) assert.fail(`${where}: en-GB spelling "${word}" in: ${text}`);
    }
  };
  // The guard is worthless if it never fires.
  for (const bad of ['cheque', 'itemised', 'totalling', 'acknowledgement', 'licence', 'honoured', 'localised']) {
    assert.ok(EN_GB.test(bad), `the en-GB guard misses "${bad}"`);
  }
  for (const good of ['check', 'itemized', 'totaling', 'acknowledgment', 'license', 'organism', 'specialist', 'analysis', 'expenses', 'because']) {
    assert.ok(!EN_GB.test(good), `the en-GB guard false-positives on "${good}"`);
  }

  // A prior year fat enough to fire nearly every rule, so the reasons are real.
  const fat = emptyPriorYear(2024);
  fat.formType = '1040';
  fat.filingStatus = 'mfj';
  fat.dependents = 3;
  fat.state = 'NY';
  fat.itemized = true;
  fat.schedules = ['1', '2', '3', 'A', 'B', 'C', 'D', 'E', 'F', 'SE', '8829', '4562', '2441', '8863', '8889', '8962', '5695', '8812'];
  fat.lines = {
    '1z': 210_000, '2a': 400, '2b': 3_100, '3a': 900, '3b': 2_400, '4a': 9_000, '4b': 9_000,
    '5a': 24_000, '5b': 20_000, '6a': 31_000, '7': 18_000, '8': 96_000, '26': 12_000,
    'schA-5': 10_000, 'schA-8': 14_000, 'schA-14': 6_500, 'schA-17': 30_500,
    'sch1-3': 96_000, 'sch1-5': 22_000, 'sch1-8': 1_200, 'digital-assets': 1,
  };
  fat.documentCounts = Object.fromEntries(DOC_TYPES.map((d) => [d.id, 2]));
  fat.issuers = [{ docTypeId: 'w2', name: 'Acme Corp' }];
  fat.confidence = 0.97;

  const reasons = generateChecklist({ prior: fat, taxYear: 2025 });
  assert.ok(reasons.length >= 25, `the spelling sweep only saw ${reasons.length} rules fire`);
  for (const h of reasons) clean(`rule ${h.docTypeId}`, h.reason);
  for (const s of STARTER_CHECKLIST) clean(`starter ${s.docTypeId}`, s.reason);
  for (const d of DOC_TYPES) clean(`taxonomy ${d.id}`, [d.code, d.label, d.hint, d.issuedBy].join(' '));
  for (const tone of TONES) {
    const c = DICTIONARIES.en.chase[tone];
    clean(`chase ${tone}`, [c.subject, ...c.body, c.sms].join(' '));
  }
  clean('dictionary en', [...Object.values(DICTIONARIES.en.s), ...Object.values(DICTIONARIES.en.docCode)].join(' '));
}

// ── Canonical naming ────────────────────────────────────────────────────────
{
  assert.equal(
    canonicalName({
      clientDisplayName: 'Eleanor Whitfield',
      taxYear: 2025,
      docTypeId: 'w2',
      issuer: 'Acme Corp',
      originalName: 'scan_0001.PDF',
      contentType: 'application/pdf',
    }),
    'WhitfieldE_2025_W2_AcmeCorp.pdf',
  );

  // Second W-2 from the same employer gets a suffix; the first never does.
  const base = {
    clientDisplayName: 'Eleanor Whitfield',
    taxYear: 2025,
    docTypeId: 'w2',
    issuer: 'Acme Corp',
    originalName: 'a.pdf',
    contentType: 'application/pdf',
  };
  assert.equal(canonicalName({ ...base, sequence: 1 }), canonicalName(base));
  assert.match(canonicalName({ ...base, sequence: 2 }), /_02\.pdf$/);

  // Hostile inputs must not escape the filename or the path.
  assert.equal(slugify('../../etc/passwd'), 'EtcPasswd', 'path traversal must be neutralized');
  assert.ok(!clientToken('  🙂  ').includes('/'));
  const nasty = canonicalName({
    clientDisplayName: 'Ünïcode / Näme',
    taxYear: 2025,
    docTypeId: '1099-int',
    issuer: 'A/B "Bank" <x>',
    originalName: 'file',
    contentType: 'image/jpeg',
  });
  assert.ok(!/[/\\<>":*?|]/.test(nasty), `unsafe filename: ${nasty}`);
  assert.match(nasty, /\.jpg$/, 'extension comes from content type when the name has none');

  // The bytes win over the filename. The portal transcodes HEIC to JPEG in the
  // browser, so a name still ending .heic would otherwise canonicalize JPEG
  // bytes to .heic — unopenable for the taxpayer, and invisible to OCR.
  assert.match(
    canonicalName({ ...base, originalName: 'w2-photo.heic', contentType: 'image/jpeg' }),
    /\.jpg$/,
    'a transcoded file must take its extension from contentType, not the stale name',
  );
  // ...but an unrecognized content type still defers to the name, because
  // browsers send application/octet-stream for anything uncommon.
  assert.match(
    canonicalName({ ...base, originalName: 'ledger.qbo', contentType: 'application/octet-stream' }),
    /\.qbo$/,
    'unknown content types must fall back to the filename extension',
  );

  // Path round-trip.
  const p = documentPath('firm_1', 2025, 'client_9', 'doc_3', nasty);
  assert.deepEqual(parseDocumentPath(p), {
    firmId: 'firm_1',
    taxYear: 2025,
    clientId: 'client_9',
    documentId: 'doc_3',
    fileName: nasty,
  });
  assert.equal(parseDocumentPath('firms/firm_1/assets/logo.png'), null);
}

// ── Chase cadence ───────────────────────────────────────────────────────────

{
  // Compression is monotonic: closer to the deadline is never more relaxed.
  let prev = 0;
  for (const d of [3, 10, 20, 60]) {
    const c = cadenceCompression(d);
    assert.ok(c > prev, `compression must increase with runway (${d}d)`);
    assert.ok(c > 0 && c <= 1);
    prev = c;
  }

  const start = new Date('2026-02-02T15:00:00Z'); // a Monday
  assert.ok(
    stepDueAt(start, 10, 5).getTime() < stepDueAt(start, 10, 90).getTime(),
    'a near deadline must pull the step earlier',
  );

  // Every profile escalates and stays inside the step budget.
  for (const profile of Object.values(CHASE_PROFILES)) {
    assert.ok(profile.steps.length > 0, `${profile.id} has steps`);
    let last = -1;
    for (const s of profile.steps) {
      assert.ok(s.dayOffset > last, `${profile.id} steps must be strictly ordered`);
      last = s.dayOffset;
      assert.ok(s.channels.length > 0, `${profile.id} step ${s.dayOffset} needs a channel`);
    }
  }
}

{
  // Quiet hours and weekends. Treat the date as UTC for the probe functions so
  // the check is timezone-independent.
  const hourInTz = (d: Date) => d.getUTCHours();
  const dayInTz = (d: Date) => d.getUTCDay();
  const settings = { quietHours: { start: 20, end: 8 }, sendOnWeekends: false };

  const midnight = nextSendableSlot(new Date('2026-02-03T02:00:00Z'), settings, hourInTz, dayInTz);
  assert.ok(hourInTz(midnight) >= 8 && hourInTz(midnight) < 20, `quiet hours leaked: ${midnight}`);

  const saturday = nextSendableSlot(new Date('2026-02-07T15:00:00Z'), settings, hourInTz, dayInTz);
  assert.ok(![0, 6].includes(dayInTz(saturday)), `weekend leaked: ${saturday}`);

  // Already fine — must be left alone.
  const ok = new Date('2026-02-03T15:00:00Z');
  assert.equal(nextSendableSlot(ok, settings, hourInTz, dayInTz).getTime(), ok.getTime());

  // Exhaustive: every hour of a full week must resolve to a legal slot that is
  // never earlier than the candidate. This is what catches the Friday-evening
  // case, where the walk has to clear ~60 hours to reach Monday morning.
  const weekStart = Date.parse('2026-02-02T00:00:00Z'); // Monday
  for (let h = 0; h < 24 * 7; h++) {
    const cand = new Date(weekStart + h * 3_600_000);
    const slot = nextSendableSlot(cand, settings, hourInTz, dayInTz);
    const sh = hourInTz(slot);
    assert.ok(slot.getTime() >= cand.getTime(), `went backwards from ${cand.toISOString()}`);
    assert.ok(sh >= 8 && sh < 20, `quiet hours leaked from ${cand.toISOString()} → ${slot.toISOString()}`);
    assert.ok(
      ![0, 6].includes(dayInTz(slot)),
      `weekend leaked from ${cand.toISOString()} → ${slot.toISOString()}`,
    );
    assert.ok(
      slot.getTime() - cand.getTime() <= 3 * 24 * 3_600_000,
      `deferred too far from ${cand.toISOString()} → ${slot.toISOString()}`,
    );
  }

  // No quiet hours configured: only the weekend rule applies.
  const always = { quietHours: { start: 0, end: 0 }, sendOnWeekends: true };
  const midnightSend = new Date('2026-02-03T02:00:00Z');
  assert.equal(
    nextSendableSlot(midnightSend, always, hourInTz, dayInTz).getTime(),
    midnightSend.getTime(),
  );

  // Firms that allow weekends get their Saturday send.
  const weekendOk = nextSendableSlot(
    new Date('2026-02-07T15:00:00Z'),
    { ...settings, sendOnWeekends: true },
    hourInTz,
    dayInTz,
  );
  assert.equal(weekendOk.getTime(), new Date('2026-02-07T15:00:00Z').getTime());
}

// ── Message copy ────────────────────────────────────────────────────────────

{
  const copy = {
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

  for (const tone of ['warm', 'neutral', 'firm', 'urgent', 'final'] as const) {
    const email = renderEmail(tone, copy);
    assert.ok(email.subject.length > 0 && email.subject.length <= 78, `${tone} subject length`);
    assert.ok(!/\{\{|\bundefined\b|\bNaN\b/.test(email.subject + email.body), `${tone} unrendered token`);
    assert.match(email.body, /Eleanor/, `${tone} must address the taxpayer`);
    assert.ok(email.body.includes(copy.portalUrl), `${tone} must link the portal`);

    const sms = renderSms(tone, copy);
    assert.ok(sms.length > 0 && sms.length <= 320, `${tone} sms length ${sms.length}`);
    assert.ok(sms.includes(copy.portalUrl), `${tone} sms must link the portal`);
    assert.ok(!/\{\{|\bundefined\b/.test(sms), `${tone} sms unrendered token`);
  }

  // A single outstanding item must not read like a list.
  const one = renderEmail('warm', { ...copy, outstanding: ['W-2'], outstandingCount: 1 });
  assert.ok(!/,\s*plus/.test(one.body), 'singular case should not say "plus N more"');

  // ── English is the source and may not drift ──────────────────────────────
  // Pinned to the character. Everything a taxpayer reads in English today must
  // survive every future change to the locale core.
  assert.equal(renderEmail('firm', copy).subject, 'Still need: W-2 and Form 1098, plus 2 more');
  assert.equal(
    renderEmail('neutral', copy).body,
    `Hi Eleanor,

Thanks — we've got 7 of 11. Still waiting on 4:

  •  W-2
  •  Form 1098
  •  1099-DIV
  •  1099-B

https://taxfax.xyz/p/abc123

Ava Okonkwo · Whitfield & Rowe`,
  );
  assert.equal(
    renderSms('urgent', copy),
    'Whitfield & Rowe: 4 docs missing, 26 days to the deadline. W-2 and Form 1098, plus 2 more. https://taxfax.xyz/p/abc123 — reply STOP to opt out.',
  );
  // An English message must carry no bidi control characters: they would cost a
  // segment in SMS and show as mojibake in a plain-text mail client.
  for (const tone of TONES) {
    const rendered = renderEmail(tone, copy);
    assert.ok(
      !/[\u2066-\u2069\u200e\u200f]/.test(rendered.subject + rendered.body + renderSms(tone, copy)),
      `${tone}: English must stay free of bidi controls`,
    );
  }
}

// ── i18n ────────────────────────────────────────────────────────────────────

{
  // Every locale record must be something `Intl` actually accepts, or a chase
  // send throws at 6am inside a scheduled function.
  for (const id of LOCALE_IDS) {
    const rec = LOCALES[id];
    assert.equal(rec.id, id, 'locale record must be filed under its own id');
    assert.ok(rec.endonym.length > 0 && rec.englishName.length > 0, `${id} needs both names`);
    for (const tag of [rec.bcp47, rec.listLocale ?? rec.bcp47]) {
      assert.equal(Intl.getCanonicalLocales(tag).length, 1, `${id}: ${tag} is not a valid tag`);
      new Intl.PluralRules(tag);
      new Intl.NumberFormat(tag);
      new Intl.DateTimeFormat(tag, { month: 'long', day: 'numeric' });
      new Intl.ListFormat(tag, { type: 'conjunction' });
    }
  }
  assert.equal(localeRecord('ar').dir, 'rtl', 'Arabic is the reason bidi exists here');
  assert.equal(localeRecord('nope').id, 'en', 'an unknown locale must fall back, never throw');

  // Schedule LEP: all 21 codes, unique, and every mapped locale is real.
  assert.equal(LEP_LANGUAGES.length, 21, 'twenty languages plus the cancel code');
  assert.equal(new Set(LEP_LANGUAGES.map((l) => l.code)).size, 21, 'LEP codes must be unique');
  for (const l of LEP_LANGUAGES) {
    assert.match(l.code, /^\d{3}$/, `${l.language} needs a three-digit code`);
    if (l.locale) assert.ok(isLocaleId(l.locale), `${l.code} maps to a locale we don't have`);
    const out = resolveLepCode(l.code);
    assert.equal(out.kind, l.locale ? 'supported' : 'unsupported', `${l.code} outcome`);
    assert.ok(isLocaleId(out.locale), `${l.code} must always resolve to a real locale`);
  }
  assert.equal(resolveLepCode('999').kind, 'unknown', 'a code not on the form is not an election');
  assert.equal(resolveLepCode(undefined).kind, 'unknown');
}

{
  // Dictionary completeness. A half-translated locale must fail the build, not
  // silently fall back to English in front of a taxpayer.
  const keys = Object.keys(DICTIONARIES.en.s) as StringKey[];
  const fixture = {
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

  for (const id of LOCALE_IDS) {
    const d = DICTIONARIES[id];
    assert.equal(d.locale, id, `${id} dictionary must declare its own locale`);
    assert.equal(id === 'en', d.review === 'source', `only English is the source (${id})`);

    for (const key of keys) {
      assert.ok(d.s[key] && d.s[key].length > 0, `${id} is missing string "${key}"`);
    }
    for (const docId of DESCRIPTOR_DOC_TYPE_IDS) {
      assert.ok(d.docCode[docId], `${id} is missing doc label "${docId}"`);
      docType(docId); // and it must still be a real doc type
    }

    // Plurals must cover every category CLDR actually selects for this language:
    // Russian needs four forms, Arabic six. `other` alone is a machine paste.
    const rules = new Intl.PluralRules(LOCALES[id].bcp47);
    const used = new Set<Intl.LDMLPluralRule>();
    for (let n = 0; n <= 120; n++) used.add(rules.select(n));
    for (const [name, forms] of Object.entries(d.plural)) {
      const filled: Partial<Record<Intl.LDMLPluralRule, string>> = forms;
      for (const cat of used) {
        assert.ok(filled[cat], `${id}.plural.${name} is missing the "${cat}" form`);
      }
    }

    for (const tone of TONES) {
      const t = d.chase[tone];
      assert.ok(t && t.subject && t.body.length > 0 && t.sms, `${id}/${tone} is incomplete`);

      const email = renderEmail(tone, { ...fixture, locale: id });
      const sms = renderSms(tone, { ...fixture, locale: id });
      // An unresolved slot must fail here, never in a taxpayer's inbox.
      assert.ok(
        !/\{\w+(#\w+)?\}/.test(email.subject + email.body + sms),
        `${id}/${tone} left a template slot unrendered`,
      );
      assert.ok(!/\bundefined\b|\bNaN\b/.test(email.subject + email.body + sms), `${id}/${tone} rendered a hole`);
      assert.ok(email.body.includes(fixture.portalUrl), `${id}/${tone} must link the portal`);
      assert.ok(sms.includes(fixture.portalUrl), `${id}/${tone} sms must link the portal`);
      assert.ok(sms.includes('STOP'), `${id}/${tone} sms must keep the opt-out keyword`);

      // Non-Latin text is UCS-2, so 70 characters a segment. Two segments is the
      // budget; three is a third more money for every chase text a firm sends.
      const cost = smsCost(sms);
      const ceiling = id === 'en' ? 3 : 2;
      assert.ok(
        cost.segments <= ceiling,
        `${id}/${tone} sms is ${cost.segments} ${cost.encoding} segments (${cost.units} units): ${sms}`,
      );
    }
  }

  // Arabic must isolate the Latin runs it splices in, and nothing else should.
  const ar = renderEmail('urgent', { ...fixture, locale: 'ar' as LocaleId });
  assert.ok(ar.body.includes('\u2068https://taxfax.xyz/p/abc123\u2069'), 'the URL must be isolated');
  assert.ok(ar.body.includes('\u200f  •  '), 'RTL bullet lines must be pinned with an RLM');

  // A translator may not drop or invent a slot. A translation missing
  // `{firmName}` renders a sentence about nobody; an invented slot renders
  // literal braces at a taxpayer, because `interpolate` leaves unknown names
  // verbatim on purpose so this check can catch them.
  const slotsOf = (s: string) =>
    new Set(Array.from(s.matchAll(/\{(\w+)(?:#\w+)?\}/g), (m) => m[1]));
  for (const key of keys) {
    const want = slotsOf(DICTIONARIES.en.s[key]);
    for (const id of LOCALE_IDS) {
      assert.deepEqual(slotsOf(DICTIONARIES[id].s[key]), want, `${id}.s["${key}"] slot set must match English`);
    }
  }

  // The recognition line. This is the first thing the product says *back* to a
  // taxpayer — the moment they learn whether the photo of a crumpled W-2 worked
  // — and the only place an IRS form code and a company's legal name are spliced
  // into a translated sentence. Both must survive untranslated, and in Arabic
  // both must be bidi-isolated or the sentence renders scrambled around them.
  for (const id of LOCALE_IDS) {
    const rtl = localeRecord(id).dir === 'rtl';
    const line = t(id, 'upload.gotItIssuer', { code: 'W-2', issuer: 'Acme Corp' });
    assert.ok(line.includes('W-2'), `${id}: the IRS form code must never be translated`);
    assert.ok(line.includes('Acme Corp'), `${id}: the issuer's legal name must never be translated`);
    assert.equal(
      line.includes('\u2068W-2\u2069') && line.includes('\u2068Acme Corp\u2069'),
      rtl,
      `${id}: LTR runs must be isolated in an RTL locale and left untouched in every other`,
    );
    assert.ok(
      !/[\u2066-\u2069]/.test(t(id, 'upload.gotItSaved')),
      `${id}: a string with no interpolation must carry no bidi controls`,
    );
  }
}

// ── Reasons ─────────────────────────────────────────────────────────────────

{
  // The "why we need this" sentence is the most persuasive copy in the product
  // and the single reason a taxpayer goes and finds the document. It used to be
  // an English literal frozen into the rule; it is now a key plus the evidence
  // the rule found, so it can be rebuilt in the reader's language. These checks
  // exist to keep it that way.

  const evidence = {
    count: 2,
    year: '2024',
    amount: '$45k',
    issuers: ['Acme Corporation', 'Northwind Logistics LLC'],
  };

  assert.equal(new Set(REASON_KEYS).size, REASON_KEYS.length, 'reason keys must be unique');
  assert.deepEqual(
    [...REASON_KEYS].sort(),
    (Object.keys(DICTIONARIES.en.reason) as ReasonKey[]).sort(),
    'REASON_KEYS and the English reason dictionary must be the same set',
  );

  for (const id of LOCALE_IDS) {
    const d = DICTIONARIES[id];
    for (const key of REASON_KEYS) {
      // A locale missing one reason is a taxpayer reading an English paragraph
      // inside an otherwise translated page — which is what the fallback would
      // quietly do, so it has to fail here instead.
      assert.ok(
        d.reason[key] && d.reason[key].trim().length > 0,
        `${id} is missing reason "${key}"`,
      );
    }
  }

  // Slot parity, same rule as `s`: a translator may not drop or invent one.
  const slotsOf = (s: string) =>
    new Set(Array.from(s.matchAll(/\{(\w+)(?:#\w+)?\}/g), (m) => m[1]));
  for (const key of REASON_KEYS) {
    const want = slotsOf(DICTIONARIES.en.reason[key]);
    for (const id of LOCALE_IDS) {
      assert.deepEqual(
        slotsOf(DICTIONARIES[id].reason[key]),
        want,
        `${id}.reason["${key}"] slot set must match English`,
      );
    }
    // Every slot a template asks for must be one the rules can actually supply.
    for (const slot of want) {
      assert.ok(
        ['count', 'year', 'amount', 'issuers', 'code', 'code2', 'codes'].includes(slot),
        `reason "${key}" wants an unknown slot "{${slot}}"`,
      );
    }
  }

  for (const id of LOCALE_IDS) {
    const rtl = localeRecord(id).dir === 'rtl';
    for (const key of REASON_KEYS) {
      const line = renderReason(id, { key, vars: evidence }, DICTIONARIES[id]);

      assert.ok(!/\{\w+(#\w+)?\}/.test(line), `${id}.reason["${key}"] left a slot unrendered`);
      assert.ok(
        !/\bundefined\b|\bNaN\b/.test(line),
        `${id}.reason["${key}"] rendered a hole`,
      );

      // IRS identifiers are never translated: "1099-DIV" is what is printed on
      // the paper the taxpayer is hunting for in a drawer. Only the plain-
      // language descriptor around it changes language.
      for (const code of Object.values(REASON_CODES[key] ?? {})) {
        assert.ok(
          line.includes(code),
          `${id}.reason["${key}"]: the IRS identifier "${code}" must survive translation untouched`,
        );
        // …and in an RTL sentence a code carrying Latin letters must be
        // bidi-isolated, or the clauses around it render in the wrong order.
        // Same FSI/PDI mechanism as firm names and phone numbers, never a
        // second one. A digits-only identifier ("1099") is bidi-neutral and is
        // deliberately left bare — wrapping it would be noise, not safety.
        const needsIsolate = /[A-Za-z]/.test(code);
        assert.equal(
          line.includes(`\u2068${code}\u2069`),
          rtl && needsIsolate,
          `${id}.reason["${key}"]: "${code}" must be isolated in RTL and left alone elsewhere`,
        );
      }

      if (slotsOf(DICTIONARIES.en.reason[key]).has('issuers')) {
        assert.ok(
          line.includes('Acme Corporation'),
          `${id}.reason["${key}"]: an issuer's legal name must never be translated`,
        );
        assert.equal(
          line.includes('\u2068Acme Corporation\u2069'),
          rtl,
          `${id}.reason["${key}"]: an issuer name must be isolated in RTL only`,
        );
      }
    }
  }

  // Reasons already written to Firestore are plain English sentences with no
  // key. They are recovered by matching them back against the very English
  // template that produced them, so a taxpayer reading in Arabic today sees
  // Arabic without anything being rewritten in place. If a template and its
  // recogniser ever drift, this is where it surfaces.
  for (const key of REASON_KEYS) {
    const english = renderReason('en', { key, vars: evidence }, DICTIONARIES.en);
    const back = recoverReason(english);
    assert.equal(back?.key, key, `"${key}" must be recoverable from its own English rendering`);
    assert.equal(
      renderReason('en', { key: back!.key, vars: back!.vars }, DICTIONARIES.en),
      english,
      `"${key}" must round-trip through recovery without losing its evidence`,
    );
  }

  // The resolution order a legacy request goes through, end to end.
  const legacyW2 = { reason: renderReason('en', { key: 'reason.w2Wages', vars: evidence }, DICTIONARIES.en) };
  assert.equal(
    requestReason('ar', legacyW2, DICTIONARIES.ar),
    renderReason('ar', { key: 'reason.w2Wages', vars: evidence }, DICTIONARIES.ar),
    'a persisted English reason must render in Arabic with no migration',
  );
  assert.equal(
    requestReason('ar', { reasonKey: 'reason.closing', reason: 'stale English' }, DICTIONARIES.ar),
    DICTIONARIES.ar.reason['reason.closing'],
    'an explicit key must outrank whatever English is stored beside it',
  );
  assert.equal(
    requestReason('ar', { reason: 'Bring the blue folder from your desk.' }, DICTIONARIES.ar),
    'Bring the blue folder from your desk.',
    'a sentence a preparer typed has no key and must survive verbatim',
  );
  assert.equal(requestReason('ar', {}, DICTIONARIES.ar), '', 'no reason at all must render nothing');

  // Every rule the engine can fire must land on a key that exists.
  const hits = generateChecklist({ prior: emptyPriorYear(2024), taxYear: 2025 });
  for (const hit of hits) {
    assert.ok(REASON_KEYS.includes(hit.reasonKey), `rule for ${hit.docTypeId} used an unknown reason key`);
    assert.equal(
      hit.reason,
      renderReason('en', { key: hit.reasonKey, vars: hit.reasonVars }, DICTIONARIES.en),
      `${hit.docTypeId}: the English reason must be exactly what the key renders`,
    );
  }
  for (const s of STARTER_CHECKLIST) {
    assert.ok(REASON_KEYS.includes(s.reasonKey), `starter ${s.docTypeId} used an unknown reason key`);
  }
}

// ── Language resolution ─────────────────────────────────────────────────────

{
  // The portal resolves override → client language → browser → English. That
  // third step is only reachable if "we know nothing" is distinguishable from
  // "English", which is exactly what the total `effectiveLocale` cannot say.
  assert.equal(resolveClientLocale(undefined), null, 'no client language must not claim English');
  assert.equal(resolveClientLocale(null), null, 'a missing client language must not claim English');
  assert.equal(
    resolveClientLocale({ locale: 'nope' as LocaleId, source: 'detected' }),
    null,
    'an unreadable locale is not a signal',
  );
  assert.equal(
    resolveClientLocale({ locale: 'ar', source: 'detected' }),
    'ar',
    'a known client language wins',
  );
  assert.equal(
    resolveClientLocale(undefined, false),
    'en',
    'a firm that opted out gets English, not the browser',
  );
  assert.equal(
    resolveClientLocale({ locale: 'ar', source: 'taxpayer' }, false),
    'en',
    'opting out overrides even a taxpayer choice',
  );
}

// ── "Done" means done ───────────────────────────────────────────────────────

{
  // A request for two W-2s that has one W-2 is not finished, whatever its
  // status says. The server flips the request to `accepted` on the *first*
  // document it accepts, so if this predicate trusts the status the portal
  // files "1 of 2 uploaded" under DONE and a firm files a return missing a W-2.
  const req = (status: RequestStatus, have: number, want: number) => ({
    status,
    documentIds: Array.from({ length: have }, (_, i) => `d${i}`),
    expectedCount: want,
  });

  assert.equal(requestSatisfied(req('accepted', 1, 2)), false, '1 of 2 accepted is not done');
  assert.equal(requestSatisfied(req('received', 1, 2)), false, '1 of 2 received is not done');
  assert.equal(requestSatisfied(req('accepted', 2, 2)), true, '2 of 2 accepted is done');
  assert.equal(requestSatisfied(req('accepted', 3, 2)), true, 'more than asked is still done');
  assert.equal(requestSatisfied(req('pending', 5, 2)), false, 'pending is never done');
  assert.equal(requestSatisfied(req('rejected', 2, 2)), false, 'rejected is never done');
  // A row that expects nothing still needs something to arrive.
  assert.equal(requestSatisfied(req('accepted', 0, 0)), false, 'zero of zero is not done');
  assert.equal(requestSatisfied(req('accepted', 1, 0)), true, 'one against no target is done');
  // A caller that can see uploads the request has not recorded yet.
  assert.equal(requestSatisfiedWith(req('accepted', 1, 2), 2), true, 'in-flight copies count');

  // The portal splits the checklist with `list.filter(requestSatisfied)`, and
  // `filter` hands its callback the *index* as a second argument. A predicate
  // with an optional second parameter therefore answers a different question on
  // every row — which put "1 of 2 uploaded" back under DONE while leaving it
  // under STILL NEEDED as well. Exercise it exactly the way the portal does.
  const board = [
    { id: 'engagement', ...req('accepted', 1, 1) },
    { id: 'photo-id', ...req('accepted', 1, 2) },
    { id: 'w2', ...req('accepted', 1, 2) },
    { id: '1099-int', ...req('accepted', 1, 1) },
    { id: 'closing', ...req('pending', 0, 1) },
  ];
  assert.deepEqual(
    board.filter(requestSatisfied).map((r) => r.id),
    ['engagement', '1099-int'],
    'the predicate must survive being passed straight to Array#filter',
  );
  assert.deepEqual(
    board.filter((r) => !requestSatisfied(r)).map((r) => r.id),
    ['photo-id', 'w2', 'closing'],
    'and the two halves must be exact complements — no row in both, none in neither',
  );
}

// ── Addresses and numbers that leave the building ───────────────────────────

{
  // Every address in the seed corpus. A regex that rejects a real client's
  // address is a worse bug than the header injection it was tightened to stop,
  // so the corpus is the floor: tighten the pattern all you like, this stays.
  const seeded =
    'a.vogt@icloud.com abby.ferreira@gmail.com accounting@northwindlog.com amara.n@outlook.com ava@whitfieldrowe.com bea.kowalczyk@outlook.com c.ravensworth@yahoo.com chen@whitfieldrowe.com d.oyelaran@yahoo.com d.volkov@yahoo.com dan@whitfieldrowe.com delphine.a@icloud.com documents@whitfieldrowe.com e.kwakye@gmail.com eleanor.whitfield@fastmail.com f.alrashid@icloud.com finance@cedarvine.co g.lindenberg@fastmail.com hanh.nguyen@fastmail.com hello@wrenwillow.studio ingrid.h@icloud.com isaiah.bergen@gmail.com jiwoo.park@proton.me joana.ribeiro@gmail.com kofi.mensah@gmail.com l.brassard@proton.me m.delacroix@gmail.com marcus@whitfieldrowe.com maricel.b@fastmail.com meg.lindqvist@fastmail.com meiling.hsu@gmail.com nadia.b@proton.me odalys.r@yahoo.com office@bramblelanedental.com priya@whitfieldrowe.com pv@venkatconsulting.com r.achebe@outlook.com rafa@montoyabuilds.com s.adeyemi@gmail.com saoirse.ob@fastmail.com tbergstrom@icloud.com tobias@ferncliffedesign.com trustee@harrowcreek.org vikram.c@outlook.com x.liang@outlook.com yuki.tanaka@proton.me'.split(
      ' ',
    );
  for (const addr of seeded) {
    assert.equal(isEmail(addr), true, `seeded address rejected: ${addr}`);
  }

  // Shapes outside the corpus that a real firm will meet.
  for (const addr of [
    'ava+2024@whitfieldrowe.com',
    "o'brien@example.com",
    'a@b.co',
    'partner@example.technology',
    'billing@ap.east.example.com',
    'Eleanor.Whitfield@Example.COM',
    'info@xn--80ak6aa92e.com',
  ]) {
    assert.equal(isEmail(addr), true, `legitimate address rejected: ${addr}`);
  }

  // `, ; < > "` are header separators. An address containing one is not just
  // invalid, it is a second recipient waiting for an extension to render it.
  for (const addr of [
    'quoted;semi@example.com',
    'a,b@example.com',
    'a<b>@example.com',
    'a"b@example.com',
    'a b@example.com',
    'a@example.com, evil@attacker.com',
    'a@example.com\nBcc: evil@attacker.com',
  ]) {
    assert.equal(isEmail(addr), false, `header-injection address accepted: ${addr}`);
  }

  // Malformed shapes the old "anything without spaces" pattern let through.
  for (const addr of [
    '.leading@example.com',
    'trailing.@example.com',
    'a@b..com',
    'a@-example.com',
    'user@[192.168.0.1]',
    '"john doe"@example.com',
    'jos\u00e9@example.com',
    'a@example.com.',
    'a@under_score.com',
    'a@123.45',
    '@example.com',
    'noatsign',
    '',
  ]) {
    assert.equal(isEmail(addr), false, `malformed address accepted: ${addr}`);
  }

  // The normaliser and the predicate ship together so they cannot drift: what
  // `normEmail` returns must be something `isEmail` agrees with.
  assert.equal(normEmail('  Eleanor.Whitfield@Example.COM '), 'eleanor.whitfield@example.com');
  assert.equal(normEmail('a,b@example.com'), null, 'normEmail rejects what isEmail rejects');
  assert.equal(normEmail(''), null);
  assert.equal(isEmail(normEmail('  AVA+2024@WhitfieldRowe.com ')!), true);

  // Phones. `normPhone` is the only door that produces a sendable number, so
  // everything it returns must satisfy `isE164` — that pairing is what lets the
  // send path trust a single check instead of re-deriving the rule.
  for (const raw of ['(415) 555-0142', '415-555-0142', '+1 415 555 0142', '14155550142']) {
    const norm = normPhone(raw);
    assert.equal(typeof norm, 'string', `normPhone should accept ${raw}`);
    assert.equal(isE164(norm!), true, `normPhone produced a non-E.164 string from ${raw}`);
  }
  assert.equal(normPhone('(415) 555-0142'), '+14155550142');

  // What a preparer can type straight into the field in the browser, which
  // firestore.rules does not constrain. These must never reach the SMS queue.
  for (const raw of ['call me maybe', '555-0142', '+1', '+0123456789', 'x', '']) {
    assert.equal(isE164(raw), false, `unusable number accepted as E.164: ${raw}`);
  }
  assert.equal(isE164('+14155550142'), true);
}

console.log('shared: all checks passed');