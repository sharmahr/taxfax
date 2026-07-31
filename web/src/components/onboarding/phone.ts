/**
 * Phone normalization for the client import.
 *
 * TaxFax texts these numbers. A number we guess wrong is not a cosmetic bug:
 * every reminder for the rest of the season goes somewhere that isn't the
 * taxpayer, the firm is never told, and the row looked *more* trustworthy than
 * the ones we did flag. So the contract here is narrow — we normalize what we
 * are sure of, and we say, in words, why we refused the rest.
 *
 * Deliberately dependency-free: `phone.test.ts` runs it under plain node.
 */

/** E.164: a leading '+', a non-zero country code, 8–15 digits in all. */
const E164_RE = /^\+[1-9]\d{7,14}$/;

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
 * Parses one roster cell into a number we can text, an extension, and an
 * explanation. Never returns a number it had to invent digits for.
 */
export function parsePhone(value: string): PhoneParse {
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
  let e164: string | null = null;
  if (hadPlus) {
    e164 = `+${digits}`;
  } else if (digits.length === 10) {
    e164 = `+1${digits}`; // a bare US number, the overwhelming common case
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

/** The dialable number, or null. Mirrors `normPhone` in functions/src/lib/validate.ts. */
export function normPhone(value: string): string | null {
  return parsePhone(value).e164;
}
