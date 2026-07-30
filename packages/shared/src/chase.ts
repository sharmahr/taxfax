/**
 * The chase engine's cadence and copy.
 *
 * Escalation here means *shorter and more specific*, not louder. The messages
 * that actually get documents back name the exact missing item and give one
 * link. Everything below is written to that rule.
 */

import type { ChaseProfile, ChaseProfileId, ChaseSettings, ChaseTone } from './models.ts';

export const CHASE_PROFILES: Record<ChaseProfileId, ChaseProfile> = {
  gentle: {
    id: 'gentle',
    label: 'Gentle',
    description: 'Email only, roughly every ten days. For long-standing clients you never want to nag.',
    steps: [
      { index: 0, dayOffset: 0, channels: ['email'], tone: 'warm' },
      { index: 1, dayOffset: 10, channels: ['email'], tone: 'neutral' },
      { index: 2, dayOffset: 21, channels: ['email'], tone: 'firm' },
      { index: 3, dayOffset: 32, channels: ['email'], tone: 'urgent', notifyStaff: true },
    ],
  },
  standard: {
    id: 'standard',
    label: 'Standard',
    description: 'Email first, SMS from week two. The right default for most of a firm’s book.',
    steps: [
      { index: 0, dayOffset: 0, channels: ['email'], tone: 'warm' },
      { index: 1, dayOffset: 5, channels: ['email'], tone: 'neutral' },
      { index: 2, dayOffset: 11, channels: ['email', 'sms'], tone: 'firm' },
      { index: 3, dayOffset: 18, channels: ['email', 'sms'], tone: 'urgent' },
      { index: 4, dayOffset: 26, channels: ['email', 'sms'], tone: 'final', notifyStaff: true },
    ],
  },
  relentless: {
    id: 'relentless',
    label: 'Relentless',
    description: 'Both channels from day three. For the twenty clients who always file on 14 April.',
    steps: [
      { index: 0, dayOffset: 0, channels: ['email'], tone: 'warm' },
      { index: 1, dayOffset: 3, channels: ['email', 'sms'], tone: 'neutral' },
      { index: 2, dayOffset: 7, channels: ['email', 'sms'], tone: 'firm' },
      { index: 3, dayOffset: 12, channels: ['email', 'sms'], tone: 'urgent' },
      { index: 4, dayOffset: 17, channels: ['email', 'sms'], tone: 'final' },
      { index: 5, dayOffset: 23, channels: ['email', 'sms'], tone: 'final', notifyStaff: true },
    ],
  },
};

export const DEFAULT_CHASE_SETTINGS: ChaseSettings = {
  enabled: true,
  profile: 'standard',
  quietHours: { start: 20, end: 8 },
  sendOnWeekends: false,
  deadline: '04-15',
  escalateAfterStep: 4,
  smsEnabled: true,
  signature: '',
};

/**
 * As the filing deadline approaches, the gaps between steps compress. Thirty
 * days out a five-day gap is fine; five days out it is negligence.
 */
export function cadenceCompression(daysToDeadline: number): number {
  if (daysToDeadline <= 7) return 0.34;
  if (daysToDeadline <= 14) return 0.5;
  if (daysToDeadline <= 30) return 0.7;
  return 1;
}

export function stepDueAt(
  startedAt: Date,
  dayOffset: number,
  daysToDeadline: number,
): Date {
  const scaled = dayOffset * cadenceCompression(daysToDeadline);
  const due = new Date(startedAt);
  due.setDate(due.getDate() + Math.round(scaled));
  return due;
}

/**
 * Shifts a send time out of quiet hours and off weekends. Returns the moment
 * the message may legally and decently be delivered, in the firm's timezone.
 *
 * Jumps straight to the next legal boundary rather than crawling hour by hour —
 * a Friday-evening candidate has to clear ~60 hours to reach Monday morning,
 * and an hourly walk would need a guard big enough to hide its own failures.
 */
export function nextSendableSlot(
  candidate: Date,
  settings: Pick<ChaseSettings, 'quietHours' | 'sendOnWeekends'>,
  hourInTz: (d: Date) => number,
  dayInTz: (d: Date) => number,
): Date {
  const { start, end } = settings.quietHours;
  const out = new Date(candidate);

  // Quiet → next weekday morning is at most: open the quiet window, skip
  // Saturday, skip Sunday, re-open Monday's quiet window. Four hops.
  for (let guard = 0; guard < 6; guard++) {
    const hour = hourInTz(out);
    const inQuiet =
      start === end ? false : start > end ? hour >= start || hour < end : hour >= start && hour < end;

    if (inQuiet) {
      // Advance to the top of the hour quiet ends, in the firm's timezone.
      const delta = (end - hour + 24) % 24 || 1;
      out.setUTCHours(out.getUTCHours() + delta, 0, 0, 0);
      continue;
    }

    const day = dayInTz(out);
    if ((day === 0 || day === 6) && !settings.sendOnWeekends) {
      // A whole day preserves the local hour, so the quiet check still holds
      // on the next pass — and DST drift self-corrects there too.
      out.setUTCHours(out.getUTCHours() + 24, 0, 0, 0);
      continue;
    }
    return out;
  }
  return out;
}

// ── Copy ────────────────────────────────────────────────────────────────────

export interface ChaseCopyInput {
  clientFirstName: string;
  firmName: string;
  preparerName: string;
  /** Doc-type labels still outstanding, most important first. */
  outstanding: string[];
  outstandingCount: number;
  totalCount: number;
  portalUrl: string;
  daysWaiting: number;
  daysToDeadline: number;
  signature: string;
}

export interface RenderedMessage {
  subject: string;
  body: string;
}

const listTop = (items: string[], max = 3): string => {
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  const joined =
    shown.length <= 1
      ? (shown[0] ?? 'a few documents')
      : `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
  return rest > 0 ? `${joined}, plus ${rest} more` : joined;
};

const bullets = (items: string[]): string => items.map((i) => `  •  ${i}`).join('\n');

export function renderEmail(tone: ChaseTone, c: ChaseCopyInput): RenderedMessage {
  const done = c.totalCount - c.outstandingCount;
  const sig = c.signature || `${c.preparerName}\n${c.firmName}`;

  switch (tone) {
    case 'warm':
      return {
        subject: `Your ${c.firmName} document checklist is ready`,
        body: `Hi ${c.clientFirstName},

We've built your document checklist for this year's return. It's ${c.totalCount} ${c.totalCount === 1 ? 'item' : 'items'}, drawn from what was on your last return, so there's nothing on it you don't actually need.

${bullets(c.outstanding.slice(0, 6))}${c.outstanding.length > 6 ? `\n  …and ${c.outstanding.length - 6} more` : ''}

You can upload straight from your phone — photos are fine, we'll straighten and rename everything.

${c.portalUrl}

${sig}`,
      };

    case 'neutral':
      return {
        subject: `${c.outstandingCount} ${c.outstandingCount === 1 ? 'document' : 'documents'} left for your return`,
        body: `Hi ${c.clientFirstName},

${done > 0 ? `Thanks — we've got ${done} of ${c.totalCount}. Still waiting on ${c.outstandingCount}:` : `We're still waiting on all ${c.outstandingCount} ${c.outstandingCount === 1 ? 'item' : 'items'}:`}

${bullets(c.outstanding)}

${c.portalUrl}

${sig}`,
      };

    case 'firm':
      return {
        subject: `Still need: ${listTop(c.outstanding, 2)}`,
        body: `Hi ${c.clientFirstName},

It's been ${c.daysWaiting} days. We can't start your return until these arrive:

${bullets(c.outstanding)}

If something on this list doesn't apply this year, reply and tell us — we'll take it off rather than keep asking.

${c.portalUrl}

${sig}`,
      };

    case 'urgent':
      return {
        subject: `Your return is on hold — ${c.outstandingCount} ${c.outstandingCount === 1 ? 'item' : 'items'} missing`,
        body: `${c.clientFirstName},

Your return is now the only thing standing between you and being finished, and it's waiting on ${c.outstandingCount} ${c.outstandingCount === 1 ? 'document' : 'documents'}:

${bullets(c.outstanding)}

${c.daysToDeadline <= 30 ? `The filing deadline is ${c.daysToDeadline} days away. Past that we'd need to file an extension, which doesn't extend the deadline to pay.` : `The longer this sits, the more likely we end up filing an extension.`}

Upload here — it takes about two minutes:
${c.portalUrl}

${sig}`,
      };

    case 'final':
      return {
        subject: `Extension likely — last call for your documents`,
        body: `${c.clientFirstName},

This is our last automatic reminder. We still don't have:

${bullets(c.outstanding)}

Unless these arrive in the next few days we'll file an extension for you and pick this up afterwards. An extension gives you more time to file, not more time to pay, so any balance due still accrues interest from ${monthDay(c.daysToDeadline)}.

${c.portalUrl}

If there's a reason you're stuck, reply to this email and we'll sort it out directly.

${sig}`,
      };
  }
}

export function renderSms(tone: ChaseTone, c: ChaseCopyInput): string {
  const top = listTop(c.outstanding, 2);
  switch (tone) {
    case 'warm':
    case 'neutral':
      return `${c.firmName}: hi ${c.clientFirstName}, we still need ${top} for your tax return. Upload in 2 min: ${c.portalUrl} — reply STOP to opt out.`;
    case 'firm':
      return `${c.firmName}: ${c.daysWaiting} days waiting on ${top}. Your return can't start without it. ${c.portalUrl} — reply STOP to opt out.`;
    case 'urgent':
      return `${c.firmName}: ${c.outstandingCount} docs missing, ${c.daysToDeadline} days to the deadline. ${top}. ${c.portalUrl} — reply STOP to opt out.`;
    case 'final':
      return `${c.firmName}: last call — without ${top} we'll file an extension. ${c.portalUrl} — reply STOP to opt out.`;
  }
}

function monthDay(daysToDeadline: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysToDeadline);
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

export const TONE_LABEL: Record<ChaseTone, string> = {
  warm: 'Opening',
  neutral: 'Reminder',
  firm: 'Firm',
  urgent: 'Urgent',
  final: 'Final notice',
};
