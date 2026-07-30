import { nextSendableSlot, type ChaseSettings } from '@taxfax/shared';

/** The client's local hour (0–23) for a given instant, per the firm timezone. */
export function tzHourFn(timezone: string): (d: Date) => number {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', hourCycle: 'h23' });
  return (d) => {
    const h = Number(fmt.format(d));
    return Number.isNaN(h) ? d.getHours() : h % 24;
  };
}

const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** The client's local weekday (0=Sun) for a given instant, per the firm timezone. */
export function tzDayFn(timezone: string): (d: Date) => number {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' });
  return (d) => DOW[fmt.format(d)] ?? d.getDay();
}

export type ShiftReason = 'quiet_hours' | 'weekend' | null;

export interface SendSlot {
  at: Date;
  /** True when the candidate fell in quiet hours or on a weekend and had to move. */
  shifted: boolean;
  reason: ShiftReason;
}

/**
 * The earliest instant a message could actually leave, given the firm's quiet
 * hours and business days interpreted in the *client's* timezone. This is what
 * makes a scheduled 2am send visibly impossible.
 */
export function legalSendSlot(
  candidate: Date,
  settings: Pick<ChaseSettings, 'quietHours' | 'sendOnWeekends'>,
  timezone: string,
): SendSlot {
  const hourInTz = tzHourFn(timezone);
  const dayInTz = tzDayFn(timezone);
  const at = nextSendableSlot(candidate, settings, hourInTz, dayInTz);
  const shifted = at.getTime() !== candidate.getTime();

  let reason: ShiftReason = null;
  if (shifted) {
    const { start, end } = settings.quietHours;
    const h = hourInTz(candidate);
    const inQuiet = start === end ? false : start > end ? h >= start || h < end : h >= start && h < end;
    const day = dayInTz(candidate);
    const weekend = (day === 0 || day === 6) && !settings.sendOnWeekends;
    reason = inQuiet ? 'quiet_hours' : weekend ? 'weekend' : null;
  }
  return { at, shifted, reason };
}

/** A short, timezone-correct label like "Tue, Feb 10, 8:00 AM". */
export function formatSlot(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}
