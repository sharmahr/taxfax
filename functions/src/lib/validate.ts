/**
 * Hand-rolled validators. Deliberately not zod: the Functions bundle stays at
 * firebase-admin + firebase-functions + unpdf, and these few rules are all the
 * product needs. Every function here is pure — callers decide what to throw.
 *
 * Email and phone are *not* defined here any more. They were, and the browser
 * had its own byte-identical copy, which is how a pattern gets tightened in one
 * place and left alone in the other. They now live in `@taxfax/shared` so both
 * ends validate a contact the same way, and are re-exported here so call sites
 * do not have to care where they came from.
 */
export {
  E164_RE,
  EMAIL_RE,
  isE164,
  isEmail,
  normEmail,
  normPhone,
  parsePhone,
  type PhoneParse,
} from '../../../packages/shared/src/contact.ts';

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
