/**
 * Who a chase step goes to — and, more to the point, who it does not.
 *
 *   node --experimental-strip-types --test functions/src/chase/recipients.test.ts
 *
 * `resolveRecipients` is the last code that looks at a phone number before it
 * becomes the `to` of a message in the Twilio extension's queue. Numbers do not
 * all arrive through `normPhone`: `firestore.rules` lets any preparer's browser
 * write `primaryContact.phone` directly — the client rule constrains
 * `displayName` and nothing else — so "call the office", an empty string, or a
 * ten-digit number with no country code can all be sitting in a client record
 * right now. Verified against the emulator: a preparer context can create and
 * update a client with an arbitrary phone string.
 *
 * The two failures these tests hold apart:
 *  - sending an unusable string to the SMS provider, and
 *  - refusing it silently, so the firm believes a taxpayer was chased when
 *    nobody was ever texted.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRecipients, dispatchCount } from './recipients.ts';
import type { ChaseSettings, ChaseStep, Client, Contact } from '../../../packages/shared/src/index.ts';

const step = (channels: Array<'email' | 'sms'>): ChaseStep =>
  ({ index: 0, dayOffset: 0, tone: 'warm', channels, notifyStaff: false }) as ChaseStep;

const settings = (smsEnabled = true): ChaseSettings => ({ smsEnabled }) as ChaseSettings;

const client = (primary: Partial<Contact>, secondary?: Partial<Contact>): Client =>
  ({
    id: 'c1',
    displayName: 'Probe Client',
    primaryContact: { name: 'Probe', email: '', ...primary } as Contact,
    secondaryContact: secondary ? ({ name: 'Second', email: '', ...secondary } as Contact) : undefined,
  }) as Client;

describe('resolveRecipients — phone numbers reaching the SMS queue', () => {
  it('sends to a number that is already E.164', () => {
    const rec = resolveRecipients(client({ phone: '+14155550123' }), step(['sms']), settings());
    assert.deepEqual(rec.phones, ['+14155550123']);
    assert.deepEqual(rec.smsUnreachable, []);
  });

  it('refuses free text a preparer typed into the phone field', () => {
    for (const junk of ['call the office', '¯\\_(ツ)_/¯', 'x', '415-555-0123 ext 4', '+1 (415) 555-0123']) {
      const rec = resolveRecipients(client({ phone: junk }), step(['sms']), settings());
      assert.deepEqual(rec.phones, [], `"${junk}" must never reach the SMS queue`);
      assert.deepEqual(rec.smsUnreachable, [junk], `"${junk}" must be reported, not dropped`);
    }
  });

  it('refuses a ten-digit US number that never went through normPhone', () => {
    // Dialable to a human, not to Twilio. The callable path would have made it
    // +14155550123; a direct browser write does not.
    const rec = resolveRecipients(client({ phone: '4155550123' }), step(['sms']), settings());
    assert.deepEqual(rec.phones, []);
    assert.deepEqual(rec.smsUnreachable, ['4155550123']);
  });

  it('counts the refusal so it cannot be silent', () => {
    const rec = resolveRecipients(client({ phone: 'nope' }), step(['sms']), settings());
    assert.equal(rec.smsUnreachable.length, 1);
    assert.equal(rec.smsSuppressed, false, 'an unusable number is not an opt-out');
  });

  it('keeps the good number and refuses the bad one on the same client', () => {
    const rec = resolveRecipients(
      client({ phone: '+14155550123' }, { phone: 'ask mum' }),
      step(['sms']),
      settings(),
    );
    assert.deepEqual(rec.phones, ['+14155550123']);
    assert.deepEqual(rec.smsUnreachable, ['ask mum']);
  });

  it('still sends the email when the phone is unusable', () => {
    const rec = resolveRecipients(
      client({ email: 'ava@whitfieldrowe.com', phone: 'call me' }),
      step(['email', 'sms']),
      settings(),
    );
    assert.deepEqual(rec.emails, ['ava@whitfieldrowe.com']);
    assert.deepEqual(rec.phones, []);
    assert.equal(dispatchCount(rec), 1, 'the refused number must not be budgeted as a send');
  });

  it('does not count a refused number against the daily send budget', () => {
    const rec = resolveRecipients(client({ phone: 'nope' }), step(['sms']), settings());
    assert.equal(dispatchCount(rec), 0);
  });
});

describe('resolveRecipients — the distinctions that were already there', () => {
  it('reports an opt-out as an opt-out, not as an unusable number', () => {
    const rec = resolveRecipients(
      client({ phone: '+14155550123', smsOptOut: true }),
      step(['sms']),
      settings(),
    );
    assert.deepEqual(rec.phones, []);
    assert.deepEqual(rec.smsUnreachable, [], 'an opted-out number was never refused for its shape');
    assert.equal(rec.smsSuppressed, true);
  });

  it('says nothing about SMS when the step or the firm has it off', () => {
    const off = resolveRecipients(client({ phone: 'junk' }), step(['sms']), settings(false));
    assert.deepEqual(off.smsUnreachable, []);
    assert.equal(off.smsSuppressed, false);

    const emailOnly = resolveRecipients(client({ phone: 'junk' }), step(['email']), settings());
    assert.deepEqual(emailOnly.smsUnreachable, []);
  });

  it('still suppresses email on an opt-out', () => {
    const rec = resolveRecipients(
      client({ email: 'ava@whitfieldrowe.com', emailOptOut: true }),
      step(['email']),
      settings(),
    );
    assert.deepEqual(rec.emails, []);
    assert.equal(rec.emailSuppressed, true);
  });

  it('de-duplicates a number both contacts share', () => {
    const rec = resolveRecipients(
      client({ phone: '+14155550123' }, { phone: '+14155550123' }),
      step(['sms']),
      settings(),
    );
    assert.deepEqual(rec.phones, ['+14155550123']);
  });
});
