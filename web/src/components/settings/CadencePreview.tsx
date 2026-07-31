import { useMemo, useState } from 'react';
import { Bell, Clock, Mail, MessageSquare, MoonStar } from 'lucide-react';
import {
  CHASE_PROFILES,
  nextSendableSlot,
  renderEmail,
  renderSms,
  stepDueAt,
  TONE_LABEL,
  type ChaseSettings,
  type ChaseStep,
} from '@taxfax/shared';
import { cn } from '@/lib/cn';

/**
 * The honest preview a partner needs before turning the chase loose: the real
 * schedule these settings produce, and the exact words each client receives —
 * rendered from the same engine the server sends with. Quiet hours, weekends,
 * the SMS switch, and the escalation cap are all reflected, not approximated.
 */

const SAMPLE_OUTSTANDING = [
  'W-2 from Acme Corp',
  'Schedule E rental income & expenses',
  '1099-INT from First National',
];
const SAMPLE_TOTAL = 8;

function hourInTz(tz: string, d: Date): number {
  const s = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(d);
  return Number(s) % 24;
}
function dayInTz(tz: string, d: Date): number {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(d);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
}

function daysUntilDeadline(deadline: string, now: Date): number {
  const [m, d] = deadline.split('-').map(Number);
  if (!m || !d) return 60;
  let target = new Date(Date.UTC(now.getFullYear(), m - 1, d, 12));
  if (target.getTime() < now.getTime()) target = new Date(Date.UTC(now.getFullYear() + 1, m - 1, d, 12));
  return Math.max(0, Math.round((target.getTime() - now.getTime()) / 86_400_000));
}

interface StepView {
  step: ChaseStep;
  slot: Date;
  daysWaiting: number;
  sms: boolean;
}

export function CadencePreview({
  settings,
  timezone,
  firmName,
  slug,
  preparerName,
}: {
  settings: ChaseSettings;
  timezone: string;
  firmName: string;
  slug: string;
  preparerName: string;
}) {
  const [selected, setSelected] = useState(0);

  const { schedule, dtd } = useMemo(() => {
    const now = new Date();
    const profile = CHASE_PROFILES[settings.profile];
    const dtdVal = daysUntilDeadline(settings.deadline, now);
    const lastSent = Math.min(settings.escalateAfterStep, profile.steps.length - 1);

    const views: StepView[] = profile.steps
      .filter((s) => s.index <= lastSent)
      .map((step) => {
        const due = stepDueAt(now, step.dayOffset, dtdVal);
        const slot = settings.enabled
          ? nextSendableSlot(
              due,
              settings,
              (d) => hourInTz(timezone, d),
              (d) => dayInTz(timezone, d),
            )
          : due;
        return {
          step,
          slot,
          daysWaiting: Math.max(0, Math.round((due.getTime() - now.getTime()) / 86_400_000)),
          sms: step.channels.includes('sms') && settings.smsEnabled,
        };
      });
    return { schedule: views, dtd: dtdVal };
  }, [settings, timezone]);

  const active = schedule[Math.min(selected, schedule.length - 1)] ?? schedule[0];

  const copy = active
    ? {
        clientFirstName: 'Jordan',
        firmName,
        preparerName,
        outstanding: SAMPLE_OUTSTANDING,
        outstandingCount: SAMPLE_OUTSTANDING.length,
        totalCount: SAMPLE_TOTAL,
        portalUrl: `taxfax.xyz/p/${slug}`,
        daysWaiting: active.daysWaiting,
        daysToDeadline: dtd,
        signature: settings.signature,
      }
    : null;

  const email = active && copy ? renderEmail(active.step.tone, copy) : null;
  const sms = active && copy && active.sms ? renderSms(active.step.tone, copy) : null;

  const dateFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

  return (
    <div className="space-y-4">
      <div>
        <p className="label-eyebrow">The schedule</p>
        <p className="mt-1 text-2xs text-ink-faint">
          From the day a client's checklist goes out. Times shown in your firm's timezone
          {settings.enabled ? ', already shifted out of quiet hours and weekends.' : '.'}
        </p>
      </div>

      {!settings.enabled ? (
        <div className="flex items-center gap-2 rounded-lg border border-status-warn/25 bg-status-warn-wash px-3 py-2 text-2xs text-status-warn">
          <MoonStar className="size-3.5 shrink-0" />
          Automatic chasing is off. Nothing sends until you turn it on.
        </div>
      ) : null}

      <ol className="space-y-1.5">
        {schedule.map((v, i) => {
          const isActive = active === v;
          return (
            <li key={v.step.index}>
              <button
                type="button"
                onClick={() => setSelected(i)}
                aria-pressed={isActive}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left',
                  'transition-colors duration-100 ease-out-quint',
                  isActive
                    ? 'border-line-strong bg-surface-sunken'
                    : 'border-line bg-surface hover:bg-surface-sunken/60',
                )}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line-strong text-2xs font-medium tabular-nums text-ink-muted">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-ink">{TONE_LABEL[v.step.tone]}</span>
                    <Mail className="size-3 text-ink-faint" aria-label="Email" />
                    {v.sms ? <MessageSquare className="size-3 text-ink-faint" aria-label="SMS" /> : null}
                    {v.step.notifyStaff ? (
                      <Bell className="size-3 text-ink-faint" aria-label="Alerts preparer" />
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-2xs tabular-nums text-ink-faint">
                    {dateFmt.format(v.slot)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
        <li className="flex items-center gap-3 rounded-lg border border-dashed border-line px-3 py-2">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-ink-faint">
            <Bell className="size-3" />
          </span>
          <p className="text-2xs text-ink-muted">
            Then TaxFax stops and hands {preparerName ? `${preparerName.split(' ')[0]}` : 'the preparer'} the
            client to call directly.
          </p>
        </li>
      </ol>

      {email ? (
        <div className="space-y-3 border-t border-line pt-4">
          <div className="flex items-center justify-between">
            <p className="label-eyebrow">What they receive</p>
            <span className="text-2xs text-ink-faint">
              Step {(active ? schedule.indexOf(active) : 0) + 1} · {active ? TONE_LABEL[active.step.tone] : ''}
            </span>
          </div>

          {/* Keyed on the step, so picking a different rung of the ladder plays the
              swap. Without it the subject and body substitute in place and the
              preview looks like it never responded to the click. */}
          <div
            key={active?.step.index}
            className="swap-in overflow-hidden rounded-lg border border-line bg-surface"
          >
            <div className="flex items-center gap-2 border-b border-line bg-surface-sunken/60 px-3 py-2">
              <Mail className="size-3.5 text-ink-faint" />
              <span className="text-2xs text-ink-faint">To Jordan Rivera</span>
            </div>
            <div className="px-3.5 py-3">
              <p className="text-sm font-semibold text-ink">{email.subject}</p>
              <p className="mt-2 whitespace-pre-line text-2xs leading-relaxed text-ink-muted">
                {email.body}
              </p>
            </div>
          </div>

          {active?.sms ? (
            <div key={active.step.index} className="swap-in flex items-start gap-2">
              <MessageSquare className="mt-1.5 size-3.5 shrink-0 text-ink-faint" />
              <p className="max-w-[85%] rounded-2xl rounded-tl-sm bg-surface-sunken px-3 py-2 text-2xs leading-relaxed text-ink-muted">
                {sms}
              </p>
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-2xs text-ink-faint">
              <Clock className="size-3" />
              This step is email only.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
