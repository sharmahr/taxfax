import { useEffect, useRef } from 'react';
import type { ChaseSettings } from '@taxfax/shared';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { cn } from '@/lib/cn';
import { firstName, timeAgo } from '@/lib/format';
import { AttentionBadge } from './chaseUi';
import { formatSlot, legalSendSlot } from './sendWindow';
import type { ChaseRow, ChaseTab } from './useChaseData';

const TABS: { id: ChaseTab; label: string }[] = [
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'attention', label: 'Attention' },
  { id: 'paused', label: 'Paused' },
  { id: 'sent', label: 'Sent' },
];

const EMPTY_COPY: Record<ChaseTab, string> = {
  scheduled: 'No sends queued. Start a chase from a client’s file.',
  attention: 'Every chase is landing. Nothing needs a human.',
  paused: 'Nothing paused right now.',
  sent: 'No messages have gone out in the last 12 days.',
};

interface ChaseListProps {
  tab: ChaseTab;
  onTabChange: (t: ChaseTab) => void;
  byTab: Record<ChaseTab, ChaseRow[]>;
  counts: Record<ChaseTab, number>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  settings: ChaseSettings;
  timezone: string;
}

export function ChaseList({ tab, onTabChange, byTab, counts, selectedId, onSelect, settings, timezone }: ChaseListProps) {
  return (
    <Tabs value={tab} onValueChange={(v) => onTabChange(v as ChaseTab)} className="flex h-full min-h-0 flex-col">
      <div className="px-3 pt-2">
        <TabsList className="w-full justify-start gap-4 overflow-x-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="shrink-0">
              {t.label}
              <Count n={counts[t.id]} warn={t.id === 'attention'} />
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {TABS.map((t) => (
        <TabsContent key={t.id} value={t.id} className="min-h-0 flex-1 overflow-y-auto pt-0 lg:overflow-y-auto">
          {byTab[t.id].length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-ink-muted">{EMPTY_COPY[t.id]}</p>
          ) : (
            <ul role="listbox" aria-label={`${t.label} chases`} className="divide-y divide-line">
              {byTab[t.id].map((row) => (
                <Row
                  key={row.client.id}
                  row={row}
                  selected={row.client.id === selectedId}
                  onSelect={() => onSelect(row.client.id)}
                  settings={settings}
                  timezone={timezone}
                />
              ))}
            </ul>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function Count({ n, warn }: { n: number; warn?: boolean }) {
  if (n === 0) return null;
  return (
    <span
      className={cn(
        'ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-2xs tabular-nums',
        warn ? 'bg-status-danger-wash text-status-danger' : 'bg-surface-sunken text-ink-muted',
      )}
    >
      {n}
    </span>
  );
}

function Row({
  row,
  selected,
  onSelect,
  settings,
  timezone,
}: {
  row: ChaseRow;
  selected: boolean;
  onSelect: () => void;
  settings: ChaseSettings;
  timezone: string;
}) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  return (
    <li ref={ref} role="option" aria-selected={selected}>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex w-full items-center gap-3 border-l-2 px-3 py-2.5 text-left transition-colors',
          selected ? 'border-ink bg-surface-sunken' : 'border-transparent hover:bg-surface-sunken/50',
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[13px] font-medium text-ink">{row.client.displayName}</span>
            {row.outstanding > 0 && (
              <span className="shrink-0 font-mono text-2xs tabular-nums text-ink-faint">{row.outstanding} left</span>
            )}
          </span>
          <span className="mt-1 flex items-center gap-2">
            <SecondaryLine row={row} settings={settings} timezone={timezone} />
          </span>
        </span>
      </button>
    </li>
  );
}

function SecondaryLine({ row, settings, timezone }: { row: ChaseRow; settings: ChaseSettings; timezone: string }) {
  if (row.attention) return <AttentionBadge reason={row.attention} />;
  if (row.status === 'paused') {
    return (
      <span className="truncate text-2xs text-ink-faint">
        Paused{row.client.chase.pausedReason ? ` · ${row.client.chase.pausedReason}` : ''}
      </span>
    );
  }
  if (row.status === 'active' && row.nextDueAt) {
    const slot = legalSendSlot(row.nextDueAt, settings, timezone);
    return <span className="truncate text-2xs text-ink-muted">Next · {formatSlot(slot.at, timezone)}</span>;
  }
  if (row.status === 'complete') {
    return <span className="truncate text-2xs text-status-success">All documents in — {firstName(row.client.displayName)} is done</span>;
  }
  if (row.lastSentAt) return <span className="truncate text-2xs text-ink-faint">Last sent {timeAgo(row.lastSentAt)}</span>;
  return <span className="truncate text-2xs text-ink-faint">Not chasing</span>;
}
