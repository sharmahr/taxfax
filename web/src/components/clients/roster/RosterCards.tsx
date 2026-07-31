import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/cn';
import { Checkbox } from '@/components/ui/Checkbox';
import { ClientStagePill, StatusPill } from '@/components/ui/StatusPill';
import {
  Assignee,
  ContactFlags,
  EntityIcon,
  ProgressMeter,
  RelTime,
  WaitingIndicator,
} from '../bits';
import type { MembersIndex } from '../hooks';
import type { StatusTone } from '@/components/ui/StatusPill';
import {
  BAND_META,
  CHASE_HEALTH_TONE,
  chaseSummary,
  type DerivedClient,
  type RosterRow,
} from '../model';

const TONE_DOT: Record<StatusTone, string> = {
  neutral: 'bg-status-neutral',
  info: 'bg-status-info',
  warn: 'bg-status-warn',
  success: 'bg-status-success',
  danger: 'bg-status-danger',
};

const CARD_H = 112;
const GROUP_H = 36;

interface RosterCardsProps {
  rows: RosterRow[];
  members: MembersIndex;
  selection: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpen: (d: DerivedClient) => void;
}

export function RosterCards({ rows, members, selection, onToggleSelect, onOpen }: RosterCardsProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (rows[i].type === 'group' ? GROUP_H : CARD_H),
    overscan: 8,
    getItemKey: (i) => rows[i].key,
  });

  return (
    <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto" tabIndex={-1}>
      <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((vi) => {
          const row = rows[vi.index];
          return (
            <div
              key={vi.key}
              className="absolute inset-x-0 top-0"
              style={{ height: vi.size, transform: `translateY(${vi.start}px)` }}
            >
              {row.type === 'group' ? (
                <div className="flex h-full items-center gap-2 border-b border-line bg-surface-sunken/60 px-4">
                  <span className={cn('size-1.5 rounded-full', TONE_DOT[BAND_META[row.band].tone])} aria-hidden />
                  <span className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">
                    {BAND_META[row.band].label}
                  </span>
                  <span className="ml-auto tabular-nums text-2xs text-ink-faint">{row.count}</span>
                </div>
              ) : (
                <ClientCard
                  d={row.d}
                  members={members}
                  selected={selection.has(row.d.client.id)}
                  onToggleSelect={onToggleSelect}
                  onOpen={onOpen}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ClientCard({
  d,
  members,
  selected,
  onToggleSelect,
  onOpen,
}: {
  d: DerivedClient;
  members: MembersIndex;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onOpen: (d: DerivedClient) => void;
}) {
  const c = d.client;
  const chase = chaseSummary(d);
  const owner = c.assignedTo ? members.byId.get(c.assignedTo) : undefined;
  return (
    <div
      className={cn(
        'flex h-full items-stretch gap-3 border-b border-line px-4 py-3',
        selected && 'bg-surface-sunken/70 shadow-[inset_2px_0_0_0_var(--color-ink)]',
      )}
    >
      <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(c.id)}
          aria-label={`Select ${c.displayName}`}
        />
      </div>
      <button
        type="button"
        onClick={() => onOpen(d)}
        className="flex min-w-0 flex-1 flex-col justify-between text-left outline-hidden"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <EntityIcon type={c.entityType} />
            <span className="truncate font-medium text-ink">{c.displayName}</span>
            <ContactFlags emailBounced={d.emailBounced} smsOptOut={d.smsOptOut} />
          </div>
          <ClientStagePill stage={c.stage} />
        </div>

        <div className="flex items-center justify-between gap-3">
          <ProgressMeter accepted={d.accepted} total={d.total} percent={d.percent} inReview={d.inReview} />
          <WaitingIndicator days={d.waitingDays} overdue={d.overdue} />
        </div>

        <div className="flex items-center justify-between gap-2">
          <StatusPill tone={CHASE_HEALTH_TONE[chase.health]} dot className="min-w-0">
            <span className="truncate">{chase.line}</span>
          </StatusPill>
          <span className="flex shrink-0 items-center gap-2 text-2xs text-ink-faint">
            {chase.lastSentAt ? <RelTime at={chase.lastSentAt} className="text-ink-faint" /> : null}
            <Assignee member={owner} />
          </span>
        </div>
      </button>
    </div>
  );
}
