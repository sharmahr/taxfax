import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Checkbox } from '@/components/ui/Checkbox';
import { ClientStagePill, StatusPill } from '@/components/ui/StatusPill';
import {
  Assignee,
  ContactFlags,
  EntityIcon,
  ProgressMeter,
  RelTime,
  Tags,
  WaitingIndicator,
} from '../bits';
import type { MembersIndex } from '../hooks';
import {
  BAND_META,
  CHASE_HEALTH_TONE,
  chaseSummary,
  type DerivedClient,
  type RosterRow,
  type SortKey,
} from '../model';
import type { StatusTone } from '@/components/ui/StatusPill';

// Full strings so Tailwind sees the token; keyed by the band's status tone.
const TONE_DOT: Record<StatusTone, string> = {
  neutral: 'bg-status-neutral',
  info: 'bg-status-info',
  warn: 'bg-status-warn',
  success: 'bg-status-success',
  danger: 'bg-status-danger',
};

/** One shared column track so the header, rows and skeleton always line up. */
export const ROSTER_COLS = '2.25rem minmax(15rem,1.7fr) 8rem 8.25rem 7.25rem minmax(11rem,1.2fr) 3.5rem 2.25rem';
export const GROUP_H = 40;
export const ROW_H = 60;

const HEADER_SORT: Partial<Record<string, SortKey>> = {
  client: 'name',
  collected: 'progress',
  waiting: 'waiting',
};

interface RosterTableProps {
  rows: RosterRow[];
  members: MembersIndex;
  selection: Set<string>;
  activeId: string | null;
  allSelected: boolean;
  someSelected: boolean;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  onToggleAll: () => void;
  onToggleSelect: (id: string) => void;
  onOpen: (d: DerivedClient) => void;
  onActivate: (id: string) => void;
}

export function RosterTable(props: RosterTableProps) {
  const { rows, activeId, sort, onSort } = props;
  const parentRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  useEffect(() => {
    setScrollMargin(listRef.current?.offsetTop ?? 0);
  }, []);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => (rows[i].type === 'group' ? GROUP_H : ROW_H),
    overscan: 10,
    scrollMargin,
    getItemKey: (i) => rows[i].key,
  });

  const indexById = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r, i) => {
      if (r.type === 'client') m.set(r.d.client.id, i);
    });
    return m;
  }, [rows]);

  // Keep the keyboard-active row in view without stealing scroll from the mouse.
  useEffect(() => {
    if (!activeId) return;
    const i = indexById.get(activeId);
    if (i != null) virtualizer.scrollToIndex(i, { align: 'auto' });
  }, [activeId, indexById, virtualizer]);

  return (
    <div
      ref={parentRef}
      className="relative min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]"
      tabIndex={-1}
    >
      <div
        role="grid"
        aria-label="Clients"
        aria-rowcount={rows.length}
        aria-colcount={7}
        aria-activedescendant={activeId ? `row-${activeId}` : undefined}
      >
        <div
          role="row"
          className="sticky top-0 z-20 grid h-10 items-center gap-3 border-b border-line bg-paper/95 px-3 backdrop-blur-sm"
          style={{ gridTemplateColumns: ROSTER_COLS }}
        >
          <div role="columnheader" className="flex items-center justify-center">
            <Checkbox
              checked={props.allSelected ? true : props.someSelected ? 'indeterminate' : false}
              onCheckedChange={props.onToggleAll}
              aria-label="Select all clients"
            />
          </div>
          <HeaderCell label="Client" col="client" sort={sort} onSort={onSort} />
          <HeaderCell label="Status" />
          <HeaderCell label="Collected" col="collected" sort={sort} onSort={onSort} />
          <HeaderCell label="Waiting" col="waiting" sort={sort} onSort={onSort} align="left" />
          <HeaderCell label="Chase" />
          <HeaderCell label="Owner" align="center" />
          <div role="columnheader" aria-hidden />
        </div>

        <div ref={listRef} className="relative" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((vi) => {
            const row = rows[vi.index];
            return (
              <div
                key={vi.key}
                className="absolute inset-x-0 top-0"
                style={{ height: vi.size, transform: `translateY(${vi.start}px)` }}
              >
                {row.type === 'group' ? (
                  <GroupRow row={row} />
                ) : (
                  <ClientRow
                    d={row.d}
                    members={props.members}
                    selected={props.selection.has(row.d.client.id)}
                    active={activeId === row.d.client.id}
                    rowIndex={vi.index + 1}
                    onToggleSelect={props.onToggleSelect}
                    onOpen={props.onOpen}
                    onActivate={props.onActivate}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function HeaderCell({
  label,
  col,
  sort,
  onSort,
  align = 'left',
}: {
  label: string;
  col?: keyof typeof HEADER_SORT;
  sort?: SortKey;
  onSort?: (s: SortKey) => void;
  align?: 'left' | 'center';
}) {
  const sortKey = col ? HEADER_SORT[col] : undefined;
  const active = sortKey && sort === sortKey;
  const cls = cn(
    'label-eyebrow flex items-center gap-1',
    align === 'center' && 'justify-center',
    active && 'text-ink',
  );
  return (
    <div
      role="columnheader"
      aria-sort={sortKey ? (active ? 'descending' : 'none') : undefined}
      className="min-w-0"
    >
      {sortKey && onSort ? (
        <button type="button" className={cn(cls, 'transition-colors hover:text-ink')} onClick={() => onSort(sortKey)}>
          {label}
          <ArrowDown className={cn('size-3 transition-opacity', active ? 'opacity-100' : 'opacity-0')} />
        </button>
      ) : (
        <span className={cls}>{label}</span>
      )}
    </div>
  );
}

function GroupRow({ row }: { row: Extract<RosterRow, { type: 'group' }> }) {
  const meta = BAND_META[row.band];
  return (
    <div role="row" className="flex h-full items-center gap-2.5 border-b border-line bg-surface-sunken/60 px-3">
      <span className={cn('size-1.5 rounded-full', TONE_DOT[meta.tone])} aria-hidden />
      <span className="text-xs font-semibold tracking-wide text-ink">{meta.label}</span>
      <span className="text-2xs text-ink-faint">{meta.hint}</span>
      <span className="ml-auto tabular-nums text-2xs font-medium text-ink-muted">{row.count}</span>
    </div>
  );
}

interface ClientRowProps {
  d: DerivedClient;
  members: MembersIndex;
  selected: boolean;
  active: boolean;
  rowIndex: number;
  onToggleSelect: (id: string) => void;
  onOpen: (d: DerivedClient) => void;
  onActivate: (id: string) => void;
}

const ClientRow = memo(function ClientRow({
  d,
  members,
  selected,
  active,
  rowIndex,
  onToggleSelect,
  onOpen,
  onActivate,
}: ClientRowProps) {
  const c = d.client;
  const chase = chaseSummary(d);
  const owner = c.assignedTo ? members.byId.get(c.assignedTo) : undefined;
  return (
    <div
      id={`row-${c.id}`}
      role="row"
      aria-rowindex={rowIndex}
      aria-selected={selected}
      data-active={active || undefined}
      data-selected={selected || undefined}
      onClick={() => {
        onActivate(c.id);
        onOpen(d);
      }}
      className={cn(
        'group grid h-full cursor-pointer items-center gap-3 border-b border-line/70 px-3 text-sm',
        'transition-colors duration-100 ease-out-quint hover:bg-surface-sunken/50',
        'data-[active=true]:bg-surface-sunken data-[active=true]:ring-1 data-[active=true]:ring-inset data-[active=true]:ring-line-strong',
        'data-[selected=true]:bg-surface-sunken/70 data-[selected=true]:shadow-[inset_2px_0_0_0_var(--color-ink)]',
      )}
      style={{ gridTemplateColumns: ROSTER_COLS }}
    >
      <div role="gridcell" className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect(c.id)}
          aria-label={`Select ${c.displayName}`}
        />
      </div>

      <div role="gridcell" className="min-w-0">
        <div className="flex items-center gap-1.5">
          <EntityIcon type={c.entityType} />
          <span className="truncate font-medium text-ink">{c.displayName}</span>
          <ContactFlags emailBounced={d.emailBounced} smsOptOut={d.smsOptOut} />
          <Tags tags={c.tags ?? []} className="ml-0.5 hidden xl:inline-flex" />
        </div>
        <div className="mt-0.5 truncate text-2xs text-ink-faint">{c.primaryContact?.email ?? '—'}</div>
      </div>

      <div role="gridcell" className="min-w-0">
        <ClientStagePill stage={c.stage} />
      </div>

      <div role="gridcell">
        <ProgressMeter accepted={d.accepted} total={d.total} percent={d.percent} inReview={d.inReview} />
      </div>

      <div role="gridcell">
        <WaitingIndicator days={d.waitingDays} overdue={d.overdue} />
      </div>

      <div role="gridcell" className="min-w-0">
        <div className="flex items-center gap-1.5">
          <StatusPill tone={CHASE_HEALTH_TONE[chase.health]} dot className="max-w-full">
            <span className="truncate">{chase.line}</span>
          </StatusPill>
        </div>
        {chase.lastSentAt ? (
          <div className="mt-0.5 truncate text-2xs text-ink-faint">
            last chased <RelTime at={chase.lastSentAt} className="text-ink-faint" />
          </div>
        ) : null}
      </div>

      <div role="gridcell" className="flex justify-center">
        <Assignee member={owner} />
      </div>

      <div role="gridcell" className="flex justify-center text-ink-faint">
        <ChevronRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100 group-data-[active=true]:opacity-100" />
      </div>
    </div>
  );
});
