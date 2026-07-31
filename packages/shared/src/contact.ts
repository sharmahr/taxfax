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
 * A desk extension at the end of the number. Rosters from Lacerte, Drake and
 * every spreadsheet in between write these five ways, and all five used to be
 * concatenated onto the number itself.
 */
const EXTENSION_RE = /[\s,;.-]*(?:\bext(?:n|ension)?\b\.?|\bx\.?|#)\s*:?\s*(\d{1,6})\s*$/i;

/** Punctuation a human uses to lay a number out. Anything else is not a number. */
const FORMATTING_RE = /[\s().\-–—/\\+]/g;

export interface PhoneParse {
  /** The number we are willing to text. Null means we refused. */
  e164: string | null;
  /** A desk extension we lifted off the end, kept out of the number. */
  extension?: string;
  /** Why we refused, in the importer's voice. Only set when `e164` is null. */
  problem?: string;
  /** Something the firm should know about a number we did accept. */
  note?: string;
}

function refuse(raw: string, because: string): PhoneParse {
  return {
    e164: null,
    problem: `“${raw}” isn’t dialable — ${because} Imported without it, so no SMS.`,
  };
}

/**
 * Parses one phone cell into a number we can text, an extension, and an
 * explanation. Never returns a number it had to invent digits for.
 *
 * The version this replaced stripped every non-digit and prepended `+` to
 * whatever was left, so the very common roster cell `5125550111 ext 22` became
 * `+512555011122` — twelve digits, comfortably inside `E164_RE`, and therefore
 * returned as a *success*. `+512` is Mexico. Every downstream consumer,
 * including the `isE164` guard on the send path, treats it as validated,
 * because it is well-formed; what it is not is the client's number. A guard can
 * stop garbage but it cannot stop a plausible lie, so the lie must not be
 * manufactured here.
 *
 * Three shapes are unambiguous and nothing else is:
 *  - anything the writer prefixed with `+` — they told us the country, so
 *    foreign numbers keep working exactly as before;
 *  - ten digits with no `+` — a bare US number, the overwhelming common case;
 *  - eleven digits starting `1`.
 *
 * Shapes deliberately refused rather than guessed, all of which the old
 * function returned a number for:
 *  - a number with a desk extension welded on (`…0111 ext 22`) — the extension
 *    is lifted off first so its digits can never join the number;
 *  - a cell with words in it (`ask Marcus`, `call the office`, `n/a 555…`) —
 *    the old strip deleted the letters and dialled whatever digits survived;
 *  - fragments of an address or note (`apt 4b, 512.555.0111`, which used to
 *    yield `+45125550111` — the `4` came out of "4b");
 *  - a seven-digit local number, and any 9-, 12- or 13-digit string with no
 *    `+`, which could be a typo or any of several countries. We do not know
 *    which, and a wrong guess texts a stranger every week for a season while
 *    the firm is told the client was chased.
 */
export function parsePhone(value: unknown): PhoneParse {
  if (typeof value !== 'string') return { e164: null };
  const raw = value.trim();
  if (raw.length === 0) return { e164: null };

  // 1. Take the extension off first, so its digits can never join the number.
  const extMatch = raw.match(EXTENSION_RE);
  const extension = extMatch?.[1];
  const number = extension ? raw.slice(0, raw.length - extMatch![0].length).trim() : raw;
  if (number.length === 0) {
    return refuse(raw, 'it is an extension with no number in front of it.');
  }

  // 2. Whatever is left must be a number and its punctuation — nothing else.
  //    "ask Marcus" and "n/a" are notes to a colleague, not phone numbers.
  const digits = number.replace(FORMATTING_RE, '');
  if (!/^\d+$/.test(digits)) {
    return refuse(raw, 'we couldn’t read a phone number in it.');
  }

  const hadPlus = number.startsWith('+');

  // 3. Only three shapes are unambiguous. Everything else would be a guess.
  //    Note there is deliberately no trailing `else`: the one that used to be
  //    here made the 11-digit branch above it redundant and turned every
  //    unrecognised digit string into a number.
  let e164: string | null = null;
  if (hadPlus) {
    e164 = `+${digits}`;
  } else if (digits.length === 10) {
    e164 = `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    e164 = `+${digits}`;
  }

  if (e164 === null || !E164_RE.test(e164)) {
    return refuse(
      raw,
      hadPlus
        ? `+${digits} isn’t a valid international number.`
        : digits.length < 10
          ? `it has ${digits.length} digit${digits.length === 1 ? '' : 's'} and a US number needs 10.`
          : `${digits.length} digits with no country code could be any of several countries, and we won’t guess.`,
    );
  }

  if (extension) {
    return {
      e164,
      extension,
      note: `Extension ${extension} kept out of the number — a text can’t dial one, so check they read SMS on the main line.`,
    };
  }
  return { e164 };
}

/** The dialable number, or null. Refuses anything it would have to invent. */
export function normPhone(value: unknown): string | null {
  return parsePhone(value).e164;
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
