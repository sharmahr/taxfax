/**
 * Small helpers shared across the firm callables — origin resolution for the
 * links we email, avatar colours, and name parsing. Kept here so createFirm,
 * the member flows, and the portal flow stay consistent.
 */
import type { CallableRequest } from 'firebase-functions/v2/https';
import { Timestamp } from '../lib/admin.js';

const DEFAULT_ORIGIN = 'https://taxfax-364f6.web.app';

/** Milliseconds since epoch from any of the shapes a Timestampish field takes. */
export function tsMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'seconds' in value) {
    return (value as { seconds: number }).seconds * 1000;
  }
  return 0;
}

/**
 * Links we email are sign-in credentials, so the host is allow-listed: a
 * compromised staff account can't point invite or portal links at a phishing
 * domain through our sender.
 */
const ALLOWED_HOST = /(?:^|\.)(?:taxfax\.app|web\.app|firebaseapp\.com)$|^(?:localhost|127\.0\.0\.1)$/;

export function resolveOrigin(req: CallableRequest, provided?: unknown): string {
  const header = req.rawRequest?.headers?.origin;
  const candidates = [provided, header].filter((c): c is string => typeof c === 'string');
  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      if ((url.protocol === 'http:' || url.protocol === 'https:') && ALLOWED_HOST.test(url.hostname)) {
        return `${url.protocol}//${url.host}`;
      }
    } catch {
      // Not a URL — try the next candidate.
    }
  }
  return DEFAULT_ORIGIN;
}

const AVATAR_COLORS = [
  '#F97316', '#EF4444', '#EC4899', '#8B5CF6', '#6366F1', '#3B82F6',
  '#0EA5E9', '#14B8A6', '#10B981', '#84CC16', '#EAB308', '#F59E0B',
];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

/** First name for greetings; falls back to something you can address a human by. */
export function firstNameOf(fullName: string): string {
  const first = fullName.trim().split(/\s+/)[0];
  return first && first.length > 0 ? first : 'there';
}
