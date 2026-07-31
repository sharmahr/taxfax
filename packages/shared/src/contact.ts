/**
 * Email addresses and phone numbers — the two strings this product hands to a
 * mail and an SMS provider.
 *
 * They live in `shared` because both ends need them and, until now, both ends
 * had their own copy: `functions/src/lib/validate.ts` and
 * `web/src/components/onboarding/{csv,phone}.ts` each carried a byte-identical
 * regex, which is precisely the arrangement in which one of them gets fixed and
 * the others do not. The normalisers ship with the patterns for the same reason
 * — a regex tightened without its `norm*` function is a rule nothing enforces.
 *
 * The stakes are not cosmetic. A value that passes here is written into the
 * `mail/` or `messages/` queue collections, where a Firebase Extension turns it
 * into a real message: the `to` of an email, the recipient of a text.
 */

/**
 * Dot-atom local part, hostname domain. Deliberately stricter than RFC 5321.
 *
 * The old pattern was `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` — "anything without
 * spaces" — which accepted `a,b@x.com`, `a;b@x.com`, `a<b>@x.com` and
 * `a"b@x.com`. Those are not merely invalid: `, ; < > "` are the separators and
 * delimiters of an address header, and these strings are written into documents
 * that an extension renders into a message envelope. Validating the address is
 * what keeps a malformed one from becoming a second recipient.
 *
 * Shapes it accepts that matter in practice: plus-addressing
 * (`ava+2024@firm.com`), apostrophes (`o'brien@…`), single-character domain
 * labels (`a@b.co`), long TLDs (`…@example.technology`), subdomains, and
 * punycode IDNs (`…@xn--80ak6aa92e.com`).
 *
 * Shapes it excludes on purpose, all of which the old pattern accepted:
 *  - IP-literal domains (`user@[192.168.0.1]`) — no client of a CPA firm has
 *    one, and the brackets are header syntax;
 *  - quoted local parts (`"john doe"@example.com`) — RFC-legal, but the quotes
 *    and the space are exactly what we are trying to keep out of a header;
 *  - non-ASCII local parts (`josé@example.com`) — SMTPUTF8, which the provider
 *    path does not carry; the punycode form of the *domain* still passes;
 *  - a trailing root dot (`a@example.com.`), underscores in the domain, and
 *    all-numeric TLDs (`a@123.45`) — none are deliverable through the
 *    extension, and each one silently costs a real send.
 */
export const EMAIL_RE =
  /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

/** E.164: a leading '+', a non-zero country code, 8–15 digits in all. */
export const E164_RE = /^\+[1-9]\d{7,14}$/;

/** Lowercased, trimmed, valid, or null. */
export function normEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  if (email.length === 0 || email.length > 254) return null;
  return EMAIL_RE.test(email) ? email : null;
}

export function isEmail(value: unknown): value is string {
  return normEmail(value) !== null;
}

/**
 * Coerces a messy phone string to E.164, assuming US when no country code is
 * present (the overwhelming case for these firms). Returns null if it can't
 * produce something dialable rather than guessing.
 */
export function normPhone(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (raw.length === 0) return null;

  const hadPlus = raw.startsWith('+');
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.length === 0) return null;

  let e164: string;
  if (hadPlus) {
    e164 = `+${digits}`;
  } else if (digits.length === 10) {
    e164 = `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    e164 = `+${digits}`;
  } else {
    e164 = `+${digits}`;
  }
  return E164_RE.test(e164) ? e164 : null;
}

/**
 * Is this string already dialable as-is?
 *
 * The one that matters at the exit: a phone number can reach a client document
 * without ever passing `normPhone`, because the security rules let a preparer's
 * browser write `primaryContact.phone` directly. This is what the send path
 * checks before handing a string to the SMS queue.
 */
export function isE164(value: unknown): value is string {
  return typeof value === 'string' && E164_RE.test(value);
}
