/**
 * What the importer is allowed to do to a phone number.
 *
 *   node --experimental-strip-types --test web/src/components/onboarding/phone.test.ts
 *
 * TaxFax sends SMS. A number we get wrong is not a cosmetic bug: every reminder
 * for the rest of the season goes to a stranger or to nowhere, and the firm is
 * never told. So the rule this file exists to hold is narrow and absolute —
 * **either we are sure, or we say so.** Guessing is the one outcome that is
 * never allowed, because a plausible-looking wrong number is worse than a
 * flagged blank one.
 *
 * Dependency-free on purpose so it runs under plain node.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normPhone, parsePhone } from './phone.ts';

describe('phone normalization', () => {
  it('normalizes the everyday US formats a tax roster contains', () => {
    for (const raw of [
      '5125550111',
      '512-555-0111',
      '(512) 555-0111',
      '512.555.0111',
      '512 555 0111',
      '1-512-555-0111',
      '+1 512 555 0111',
      '+1 (512) 555-0111',
    ]) {
      assert.equal(normPhone(raw), '+15125550111', `${raw} should dial +15125550111`);
    }
  });

  it('keeps a country code that is already there', () => {
    assert.equal(normPhone('+44 20 7946 0018'), '+442079460018');
    assert.equal(normPhone('+52 55 1234 5678'), '+525512345678');
  });

  it('never concatenates an extension onto the number', () => {
    // The bug this file was written for: "+512555011122" is a real-looking
    // number that belongs to nobody, and it was being stored as "Ready".
    for (const raw of [
      '5125550111 ext 22',
      '5125550111 ext. 22',
      '5125550111 x22',
      '5125550111 X 22',
      '(512) 555-0111 #22',
      '512-555-0111 extension 22',
      '+1 512 555 0111 ext 22',
    ]) {
      const parsed = parsePhone(raw);
      assert.equal(parsed.e164, '+15125550111', `${raw} lost or corrupted its base number`);
      assert.equal(parsed.extension, '22', `${raw} did not surface its extension`);
      assert.ok(parsed.note, `${raw} dropped an extension without telling anyone`);
      assert.notEqual(normPhone(raw), '+512555011122');
    }
  });

  it('flags what it cannot normalize instead of inventing a number', () => {
    for (const raw of ['n/a', 'not-a-phone', '555', '5125', 'ask Marcus', '512555011199', 'ext 22', '+0 512 555 0111']) {
      const parsed = parsePhone(raw);
      assert.equal(parsed.e164, null, `${raw} was guessed into ${parsed.e164}`);
      assert.ok(parsed.problem, `${raw} was dropped with no explanation`);
      assert.match(
        parsed.problem,
        /isn’t dialable/,
        `${raw} must be flagged in the importer's own words: ${parsed.problem}`,
      );
    }
  });

  it('says nothing about a blank cell — an absent phone is not an error', () => {
    for (const raw of ['', '   ']) {
      const parsed = parsePhone(raw);
      assert.equal(parsed.e164, null);
      assert.equal(parsed.problem, undefined);
    }
  });

  it('quotes the value back so the person can find the row', () => {
    assert.match(parsePhone('555').problem ?? '', /555/);
  });
});
