/**
 * The chase engine's cadence and copy.
 *
 * Escalation here means *shorter and more specific*, not louder. The messages
 * that actually get documents back name the exact missing item and give one
 * link. Everything below is written to that rule.
 */

import type { ChaseProfile, ChaseProfileId, ChaseSettings, ChaseTone } from './models.ts';
import {
  DEFAULT_LOCALE,
  RLM,
  dictionary,
  formatList,
  formatMonthDay,
  interpolate,
  localeRecord,
  t,
  type LocaleId,
  type Vars,
} from './i18n/index.ts';

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
  /**
   * The taxpayer's language. Absent means English — so every existing caller,
   * fixture and preview keeps rendering exactly what it rendered before.
   * `outstanding` is expected to already be in this language.
   */
  locale?: LocaleId;
}

export interface RenderedMessage {
  subject: string;
  body: string;
}

const listTop = (locale: LocaleId, items: string[], max = 2): string => {
  const shown = items.slice(0, max);
  const rest = items.length - shown.length;
  const joined = shown.length === 0 ? t(locale, 'list.fallback') : formatList(locale, shown);
  return rest > 0 ? joined + t(locale, 'list.plus', { restCount: rest }) : joined;
};

/**
 * A bullet line opens with neutral characters ("  •  "), so in an RTL message it
 * would take its direction from the item — and a Latin form code would flip the
 * whole line to the left. A right-to-left mark pins it.
 */
const bulletBlock = (locale: LocaleId, items: string[], max?: number): string => {
  const mark = localeRecord(locale).dir === 'rtl' ? RLM : '';
  const shown = max === undefined ? items : items.slice(0, max);
  const lines = shown.map((i) => `${mark}  •  ${i}`);
  const rest = items.length - shown.length;
  if (rest > 0) lines.push(mark + t(locale, 'bullet.more', { restCount: rest }));
  return lines.join('\n');
};

export function renderEmail(tone: ChaseTone, c: ChaseCopyInput): RenderedMessage {
  const locale = c.locale ?? DEFAULT_LOCALE;
  const dict = dictionary(locale);
  const copy = dict.chase[tone];
  const done = c.totalCount - c.outstandingCount;
  const deadlineAt = new Date();
  deadlineAt.setDate(deadlineAt.getDate() + c.daysToDeadline);

  const vars: Vars = {
    clientFirstName: c.clientFirstName,
    firmName: c.firmName,
    preparerName: c.preparerName,
    portalUrl: c.portalUrl,
    outstandingCount: c.outstandingCount,
    totalCount: c.totalCount,
    doneCount: done,
    daysWaiting: c.daysWaiting,
    daysToDeadline: c.daysToDeadline,
    topList: listTop(locale, c.outstanding),
    deadlineDate: formatMonthDay(locale, deadlineAt),
  };

  /**
   * Paragraphs that are nothing but a slot are substituted raw. They are already
   * localized, they span line breaks, and a bidi isolate may not cross one — so
   * wrapping them would emit an unmatched PDI. Everything inline is isolated.
   */
  const blocks: Record<string, string> = {
    bullets: bulletBlock(locale, c.outstanding, tone === 'warm' ? 6 : undefined),
    lede: t(locale, done > 0 ? 'neutral.ledeSome' : 'neutral.ledeNone', vars),
    deadline: t(locale, c.daysToDeadline <= 30 ? 'urgent.deadlineNear' : 'urgent.deadlineFar', vars),
    portalUrl: c.portalUrl,
    signature: c.signature || `${c.preparerName}\n${c.firmName}`,
  };

  const render = (tpl: string): string => {
    const bare = /^\{(\w+)\}$/.exec(tpl);
    const block = bare ? blocks[bare[1]!] : undefined;
    return block ?? interpolate(tpl, vars, locale, dict.plural);
  };

  return { subject: render(copy.subject), body: copy.body.map(render).join('\n\n') };
}

export function renderSms(tone: ChaseTone, c: ChaseCopyInput): string {
  const locale = c.locale ?? DEFAULT_LOCALE;
  const dict = dictionary(locale);
  return interpolate(
    dict.chase[tone].sms,
    {
      clientFirstName: c.clientFirstName,
      firmName: c.firmName,
      portalUrl: c.portalUrl,
      outstandingCount: c.outstandingCount,
      daysWaiting: c.daysWaiting,
      daysToDeadline: c.daysToDeadline,
      topList: listTop(locale, c.outstanding),
    },
    locale,
    dict.plural,
  );
}

export const TONE_LABEL: Record<ChaseTone, string> = {
  warm: 'Opening',
  neutral: 'Reminder',
  firm: 'Firm',
  urgent: 'Urgent',
  final: 'Final notice',
};
