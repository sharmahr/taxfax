/**
 * The contact-parsing contract, from the import preview's point of view.
 *
 *   npm run test:shared
 *
 * These assertions moved here from `web/src/components/onboarding/phone.test.ts`
 * when the parser did. They are kept as a separate file from `check.ts` because
 * they are about a different thing: `check.ts` proves the parser refuses to
 * invent a number, and this proves the *preview* can be trusted to predict what
 * the server will do with one. Those are two different failures — a parser that
 * is correct but disagrees with the screen in front of the firm is still a bug.
 *
 * The stake is specific. `buildPreview` renders `problem` verbatim in the
 * import's "needs a look" ledger, and `toPayload` sends `parsePhone`'s own
 * output back through this same function on the server. So the refusal wording
 * is UI copy with a test, not a log line, and the round trip has to be a fixed
 * point or the preview would promise rows the callable then drops in silence.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normEmail, normPhone, parsePhone } from './contact.ts';

describe('phone, as the import preview depends on it', () => {
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

  /**
   * Why the import needs no second warning channel on the server.
   *
   * `toPayload` sends the E.164 this function produced, not the raw cell, and
   * `importClients` runs `normPhone` over it again. If that second pass ever
   * returned something different, the preview would have shown a firm a number
   * the callable then quietly dropped or altered — the exact silence D8 was
   * about, moved one layer down. Being a fixed point is what makes the flag on
   * screen the whole story.
   */
  it('is a fixed point, so the server cannot refuse what the preview accepted', () => {
    const shapes: string[] = [];
    for (let i = 0; i < 500; i++) {
      const ten = String(2005550000 + i * 4001);
      shapes.push(ten, `+1${ten}`, `1${ten}`, `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`, `${ten} ext ${i % 97}`);
    }
    shapes.push('+44 20 7946 0018', '+52 55 1234 5678', '+91 98765 43210', '+61 2 9374 4000', '+44 20 7946 0018 ext 5');

    let accepted = 0;
    for (const raw of shapes) {
      const once = parsePhone(raw).e164;
      if (once === null) continue;
      accepted++;
      assert.equal(parsePhone(once).e164, once, `${raw} normalized to ${once}, which does not survive a second pass`);
    }
    assert.ok(accepted > 2000, `expected the corpus to exercise the accepting branches, got ${accepted}`);
  });
});

describe('email, as the import preview depends on it', () => {
  /**
   * The preview used to carry its own `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` — "anything
   * without spaces" — and told firms these nine shapes were fine while
   * `importClients` dropped every one. Five of them carry the delimiters of an
   * address header into a document an extension renders into an envelope.
   */
  it('rejects the shapes the preview used to wave through', () => {
    for (const raw of [
      'a,b@x.com',
      'a;b@x.com',
      'a<b>@x.com',
      'a"b@x.com',
      'user@[192.168.0.1]',
      'josé@example.com',
      'a@example.com.',
      'a@ex_ample.com',
      'a@123.45',
    ]) {
      assert.equal(normEmail(raw), null, `${raw} would be shown as importable and then dropped`);
    }
  });

  it('still accepts what a real roster contains', () => {
    assert.equal(normEmail('  Eleanor.Whitfield@Example.COM '), 'eleanor.whitfield@example.com');
    for (const raw of [
      'ava+2024@whitfieldrowe.com',
      "o'brien@example.com",
      'a@b.co',
      'x@example.technology',
      'user@mail.example.co.uk',
    ]) {
      assert.equal(normEmail(raw), raw.toLowerCase(), `${raw} is a deliverable address and must import`);
    }
  });
});
