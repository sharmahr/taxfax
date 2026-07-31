import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { ProgressRing } from '@/components/ui/Progress';
import { StatusPill } from '@/components/ui/StatusPill';
import { RelTime } from '../bits';
import { CHASE_HEALTH_TONE, type ChaseSummary, type DerivedClient } from '../model';

/**
 * The strip that answers the first two questions before anyone scrolls: what's
 * outstanding, and how long it's been outstanding.
 */
export function DetailSummary({ d, chase }: { d: DerivedClient; chase: ChaseSummary }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
      <Cell
        label="Outstanding"
        value={
          d.stillNeeded === 0 ? (
            <span className="text-status-success">All in</span>
          ) : (
            <>
              {d.stillNeeded}
              <span className="text-lg text-ink-faint"> / {d.total}</span>
            </>
          )
        }
        sub={d.stillNeeded === 0 ? 'Every document received' : `documents still needed`}
      />
      <Cell
        label="Waiting"
        value={
          d.waitingDays > 0 ? (
            <>
              {d.waitingDays}
              <span className="text-lg text-ink-faint">d</span>
            </>
          ) : (
            <span className="text-ink-faint">—</span>
          )
        }
        sub={
          d.overdue > 0 ? (
            <span className="text-status-danger">{d.overdue} past due</span>
          ) : d.waitingDays > 0 ? (
            'since first request'
          ) : (
            'not started yet'
          )
        }
        tone={d.overdue > 0 ? 'danger' : d.waitingDays >= 21 ? 'warn' : undefined}
      />
      <Cell
        label="Collected"
        value={
          <span className="flex items-center gap-2">
            <ProgressRing value={d.percent} size={26} />
            {d.percent}
            <span className="text-lg text-ink-faint">%</span>
          </span>
        }
        sub={`${d.accepted} of ${d.total} accepted`}
      />
      <Cell
        label="Chase"
        value={
          <StatusPill tone={CHASE_HEALTH_TONE[chase.health]} dot className="text-xs">
            {chase.line}
          </StatusPill>
        }
        sub={
          chase.nextDueAt ? (
            <span>
              next reminder <RelTime at={chase.nextDueAt} />
            </span>
          ) : chase.lastSentAt ? (
            <span>
              last sent <RelTime at={chase.lastSentAt} />
            </span>
          ) : (
            'no reminders sent'
          )
        }
        valueSize="pill"
      />
    </dl>
  );
}

function Cell({
  label,
  value,
  sub,
  tone,
  valueSize = 'number',
}: {
  label: string;
  value: ReactNode;
  sub: ReactNode;
  tone?: 'danger' | 'warn';
  valueSize?: 'number' | 'pill';
}) {
  return (
    <div className="bg-surface px-4 py-3.5">
      <dt className="label-eyebrow">{label}</dt>
      <dd
        className={cn(
          'mt-1.5 flex items-center font-medium tabular-nums text-ink',
          valueSize === 'number' && 'text-3xl leading-none',
          tone === 'danger' && 'text-status-danger',
          tone === 'warn' && 'text-status-warn',
        )}
      >
        {value}
      </dd>
      <p className="mt-1.5 text-2xs text-ink-faint">{sub}</p>
    </div>
  );
}
