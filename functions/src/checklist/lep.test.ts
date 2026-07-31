/**
 * Schedule LEP detection — the evidence the whole feature stands on.
 *
 *   node --experimental-strip-types --test functions/src/checklist/lep.test.ts
 *
 * Schedule LEP (Form 1040) is how a taxpayer formally tells the IRS which
 * language to write to them in. If it was attached to last year's return, we
 * already have the client's language preference in the same package we parse to
 * build their checklist — no form to fill in, no question to ask the firm.
 *
 * The dangerous failure is not missing an election. It is inventing one: the
 * blank schedule lists all twenty languages and their codes, so a naive "find a
 * code on the page" reader elects Gujarati for someone who ticked nothing and
 * then chases them in a language they cannot read. Every test below exists
 * because of that, and the blank-template case is the one that matters most.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseReturnText } from './parsePriorYearReturn.ts';
import { resolveLepCode } from '../../../packages/shared/src/index.ts';

/** Enough of a 1040 to clear the parser's "is this a return at all" floor. */
const P_1040 = `Form 1040 U.S. Individual Income Tax Return 2023
Department of the Treasury—Internal Revenue Service
Your first name Mai   Last name Nguyen
Filing Status: Single
1z Total amount from Form(s) W-2, box 1 68,400
11 Adjusted gross income 68,400`;

/** The blank schedule as printed: every language, every code, nothing ticked. */
const LEP_ROWS = `001 Spanish
002 Korean
003 Vietnamese
004 Russian
005 Arabic
006 Haitian Creole
007 Tagalog
008 Portuguese
009 Polish
010 Farsi
011 French
012 Japanese
013 Gujarati
014 Punjabi
015 Khmer
016 Urdu
017 Bengali
018 Italian
019 Chinese (Traditional)
020 Chinese (Simplified)`;

const lepPage = (rows: string) => `Schedule LEP (Form 1040) 2023
Department of the Treasury Internal Revenue Service
Request for Change in Language Preference
Attach to Form 1040, 1040-SR, 1040-NR, or 1040-X.
Name shown on return Mai Nguyen   Your social security number 456-78-9012
Check the box for the language you prefer:
${rows}`;

const parse = (...pages: string[]) => parseReturnText([P_1040, ...pages]);

describe('schedule LEP detection', () => {
  it('reads the ticked language off a full schedule', () => {
    const r = parse(
      lepPage(LEP_ROWS.replace('003 Vietnamese', 'X 003 Vietnamese')),
    );
    assert.equal(r.lepCode, '003');
    assert.equal(r.lepLanguage, 'Vietnamese');
    assert.equal(resolveLepCode(r.lepCode).locale, 'vi');
  });

  it('accepts the other glyphs a checkbox survives extraction as', () => {
    for (const mark of ['x', '\u2611', '\u2612', '\u2713', '\u2714', '\u25a0']) {
      const r = parse(lepPage(LEP_ROWS.replace('004 Russian', `${mark} 004 Russian`)));
      assert.equal(r.lepCode, '004', `mark ${JSON.stringify(mark)}`);
    }
  });

  it('DOES NOT invent an election from a blank schedule', () => {
    // Twenty languages, twenty codes, no mark. Electing any of them here would
    // chase a taxpayer in a language they never asked for.
    const r = parse(lepPage(LEP_ROWS));
    assert.equal(r.lepCode, undefined);
    assert.equal(r.lepLanguage, undefined);
    assert.equal(resolveLepCode(r.lepCode).kind, 'unknown');
  });

  it('refuses to guess when two boxes are marked', () => {
    const rows = LEP_ROWS.replace('001 Spanish', 'X 001 Spanish').replace(
      '002 Korean',
      'X 002 Korean',
    );
    assert.equal(parse(lepPage(rows)).lepCode, undefined);
  });

  it('reads the condensed output tax software actually prints', () => {
    // Most packages print only the elected row rather than the whole form.
    const r = parse(lepPage('Language preference elected: 002 Korean'));
    assert.equal(r.lepCode, '002');
    assert.equal(r.lepLanguage, 'Korean');
  });

  it('reads a bare code with no language name beside it', () => {
    const r = parse(lepPage('Language code entered on Schedule LEP: 020'));
    assert.equal(r.lepCode, '020');
    assert.equal(resolveLepCode(r.lepCode).locale, 'zh-Hans');
  });

  it('finds nothing when Schedule LEP is not in the package', () => {
    assert.equal(parse().lepCode, undefined);
    assert.equal(parse('Schedule C Profit or Loss From Business').lepCode, undefined);
  });

  it('ignores a stray three-digit number on an unrelated page', () => {
    // "003" on a Schedule C is a line amount, not a language election.
    const r = parse('Schedule C (Form 1040) Profit or Loss From Business\nLine 9 Car expenses 003');
    assert.equal(r.lepCode, undefined);
  });

  it('surfaces an election in a language we cannot yet write', () => {
    // Khmer is code 015 on the form and has no dictionary. The election is still
    // detected — the firm is told about it rather than left to wonder why the
    // chase went out in English.
    const r = parse(lepPage(LEP_ROWS.replace('015 Khmer', 'X 015 Khmer')));
    assert.equal(r.lepCode, '015');
    const out = resolveLepCode(r.lepCode);
    assert.equal(out.kind, 'unsupported');
    assert.equal(out.language, 'Khmer');
    assert.equal(out.locale, 'en');
  });

  it('does not disturb the rest of the parse', () => {
    const without = parse();
    const with_ = parse(lepPage(LEP_ROWS.replace('001 Spanish', 'X 001 Spanish')));
    assert.equal(with_.lepCode, '001');
    // A language election is not a tax schedule: it must not appear in
    // `schedules`, where the ~35 checklist rules read, or the client would be
    // asked for documents because of the language they speak.
    assert.deepEqual(with_.schedules, without.schedules);
    assert.equal(with_.formType, without.formType);
    assert.equal(with_.taxYear, without.taxYear);
    assert.equal(with_.filingStatus, without.filingStatus);
    assert.deepEqual(with_.lines, without.lines);
  });
});
