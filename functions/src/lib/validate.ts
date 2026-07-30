/**
 * Hand-rolled validators. Deliberately not zod: the Functions bundle stays at
 * firebase-admin + firebase-functions + unpdf, and these few rules are all the
 * product needs. Every function here is pure — callers decide what to throw.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164_RE = /^\+[1-9]\d{7,14}$/;

/** Lowercased, trimmed, RFC-ish valid address, or null. */
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

export function isE164(value: unknown): value is string {
  return typeof value === 'string' && E164_RE.test(value);
}

/** Trimmed, single-spaced, within bounds, or null. */
export function cleanName(value: unknown, min = 1, max = 200): string | null {
  if (typeof value !== 'string') return null;
  const name = value.replace(/\s+/g, ' ').trim();
  if (name.length < min || name.length > max) return null;
  return name;
}

/** A trimmed non-empty string, or undefined — for optional free-text fields. */
export function optionalStr(value: unknown, max = 2000): string | undefined {
  if (typeof value !== 'string') return undefined;
  const s = value.trim();
  if (s.length === 0) return undefined;
  return s.slice(0, max);
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Normalises a tags input that arrives from a CSV as either an array or a
 * delimited string ("rental; s-corp, vip") into a clean, de-duped list.
 */
export function normTags(value: unknown, maxTags = 25, maxLen = 40): string[] {
  let parts: string[] = [];
  if (Array.isArray(value)) {
    parts = value.map((v) => (typeof v === 'string' ? v : String(v ?? '')));
  } else if (typeof value === 'string') {
    parts = value.split(/[;,]/);
  } else {
    return [];
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const tag = part.replace(/\s+/g, ' ').trim().slice(0, maxLen);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= maxTags) break;
  }
  return out;
}
