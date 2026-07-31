import {
  format,
  formatDistanceToNowStrict,
} from 'date-fns';
import type { Timestampish } from '@taxfax/shared';

/** Firestore timestamps, JS dates and epoch millis all normalise to a Date. */
export function toDate(ts: Timestampish): Date {
  if (ts instanceof Date) return ts;
  if (typeof ts === 'number') return new Date(ts);
  return new Date(ts.seconds * 1000);
}

/** "just now", "2 days ago" — for activity feeds and "last seen". */
export function timeAgo(ts: Timestampish): string {
  const d = toDate(ts);
  if (Math.abs(Date.now() - d.getTime()) < 45_000) return 'just now';
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

/** Absolute date for tooltips and record detail: "Mar 14, 2026". */
export function fullDate(ts: Timestampish): string {
  return format(toDate(ts), 'MMM d, yyyy');
}

/** A 0–1 fraction as a whole percent: `0.6` → "60%". */
export function percent(fraction: number): string {
  return `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`;
}

/** "Ava Whitfield" → "AW", "Whitfield & Co" → "WC", single word → first two. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** The name people answer to. "Ava Whitfield" → "Ava". */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

// File sizes already have one true implementation in the shared package.
export { formatBytes } from '@taxfax/shared';
