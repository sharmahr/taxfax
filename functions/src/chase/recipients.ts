/**
 * Who a chase step actually goes to.
 *
 * This is the one junction every send passes through — the scheduled sweep, the
 * manual "send now", and the preview the preparer sees before either — so it is
 * where a recipient is allowed to be refused. Guarding here rather than at
 * `queueSms` means the refusal is visible in the preview *before* the send, and
 * that the daily budget counts what will really go out.
 *
 * The phone check is not defensive programming. Phones enter a client document
 * through two doors: the callables in `firm/clients.ts`, which run `normPhone`,
 * and the browser, which `firestore.rules` lets any preparer write to directly —
 * the client rule constrains `displayName` and nothing else. A preparer typing
 * "call the office" into a phone field therefore puts that string one hop from
 * the `to` field of the Twilio queue. `isE164` existed in the repo the whole
 * time with no caller; this is the caller.
 *
 * A refused number is never dropped quietly. It comes back in `smsUnreachable`,
 * which the preview returns and which the sender records as a `skipped` chase
 * message against the client — because a taxpayer who silently never receives a
 * text is the exact failure this product exists to prevent.
 *
 * Kept free of value imports from the admin SDK so it can be unit-tested under
 * plain node, the way `ingest/classify.ts` is.
 */
import { isE164 } from '../../../packages/shared/src/index.ts';
import type { ChaseSettings, ChaseStep, Client, Contact } from '../../../packages/shared/src/index.ts';

export interface Recipients {
  emails: string[];
  phones: string[];
  /** Channel was called for by the step, a contact exists on it, all opted out. */
  emailSuppressed: boolean;
  smsSuppressed: boolean;
  /**
   * Numbers on file that we refused to send to, as they are stored. Not opted
   * out, not missing — unusable, and therefore something the firm has to fix.
   */
  smsUnreachable: string[];
}

function contactsOf(client: Client): Contact[] {
  return [client.primaryContact, client.secondaryContact].filter((c): c is Contact => !!c);
}

export function resolveRecipients(client: Client, step: ChaseStep, settings: ChaseSettings): Recipients {
  const contacts = contactsOf(client);
  const wantEmail = step.channels.includes('email');
  const wantSms = step.channels.includes('sms') && settings.smsEnabled;

  const emails = wantEmail
    ? [...new Set(contacts.filter((c) => c.email && !c.emailOptOut).map((c) => c.email.trim()))]
    : [];

  const candidates = wantSms
    ? [...new Set(contacts.filter((c) => c.phone && !c.smsOptOut).map((c) => c.phone!.trim()))]
    : [];
  const phones = candidates.filter((p) => isE164(p));
  const smsUnreachable = candidates.filter((p) => !isE164(p));

  return {
    emails,
    phones,
    emailSuppressed: wantEmail && emails.length === 0 && contacts.some((c) => c.email),
    // Opt-out specifically: an unusable number is a different problem with a
    // different fix, and reporting it as "opted out" would send the firm looking
    // for a consent record that does not exist.
    smsSuppressed: wantSms && phones.length === 0 && contacts.some((c) => c.phone && c.smsOptOut === true),
    smsUnreachable,
  };
}

export function dispatchCount(rec: Recipients): number {
  return (rec.emails.length > 0 ? 1 : 0) + rec.phones.length;
}
