import { useEffect, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { AlertTriangle, ArrowLeft, MousePointerClick } from 'lucide-react';
import { DEFAULT_CHASE_SETTINGS } from '@taxfax/shared';
import { useAuth } from '@/lib/auth';
import { useCommand } from '@/lib/command';
import { cn } from '@/lib/cn';
import { usePageTitle } from '@/components/shell';
import { Button } from '@/components/ui';
import {
  ChaseDetail,
  ChaseEmpty,
  ChaseList,
  ChaseSkeleton,
  ChaseSummary,
  useChaseData,
  type ChaseTab,
} from '@/components/chase';

export const Route = createFileRoute('/_app/chase')({
  validateSearch: (search: Record<string, unknown>): { c?: string } => ({
    c: typeof search.c === 'string' ? search.c : undefined,
  }),
  component: ChaseConsole,
});

const TAB_ORDER: ChaseTab[] = ['scheduled', 'attention', 'paused', 'sent'];

function ChaseConsole() {
  usePageTitle('Chase');
  const navigate = useNavigate();
  const { activeFirm } = useAuth();
  const firmId = activeFirm?.firmId ?? null;
  const firm = activeFirm?.firm ?? null;
  const role = activeFirm?.role ?? 'viewer';
  const { c: deepLink } = Route.useSearch();

  const data = useChaseData(firmId);
  const [tab, setTab] = useState<ChaseTab>('scheduled');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pane, setPane] = useState<'list' | 'detail'>('list');

  useCommand({ id: 'nav-review', group: 'Go to', label: 'Review queue', keywords: ['documents', 'classify'], run: () => navigate({ to: '/review' }) });
  useCommand({ id: 'nav-chase', group: 'Go to', label: 'Chase console', keywords: ['reminders', 'cadence'], run: () => navigate({ to: '/chase' }) });

  // A deep link from the dashboard opens straight onto that client.
  useEffect(() => {
    if (!deepLink || !data.byId.has(deepLink)) return;
    const found = TAB_ORDER.find((t) => data.byTab[t].some((r) => r.client.id === deepLink));
    if (found) setTab(found);
    setSelectedId(deepLink);
    setPane('detail');
  }, [deepLink, data.byId, data.byTab]);

  // Otherwise keep a sensible selection as data streams in.
  useEffect(() => {
    if (deepLink && data.byId.has(deepLink)) return;
    if (selectedId && data.byId.has(selectedId)) return;
    const firstTab = TAB_ORDER.find((t) => data.byTab[t].length > 0);
    if (firstTab) {
      setTab(firstTab);
      setSelectedId(data.byTab[firstTab][0].client.id);
    } else if (selectedId !== null) {
      setSelectedId(null);
    }
  }, [data.byTab, data.byId, selectedId, deepLink]);

  function onTabChange(next: ChaseTab) {
    setTab(next);
    const list = data.byTab[next];
    if (list.length > 0 && !list.some((r) => r.client.id === selectedId)) {
      setSelectedId(list[0].client.id);
    }
  }

  function onSelect(id: string) {
    setSelectedId(id);
    setPane('detail');
  }

  if (!firmId || !firm || data.loading) return <ChaseSkeleton />;
  if (data.error) return <ChaseError />;

  const settings = firm.chase ?? DEFAULT_CHASE_SETTINGS;
  const timezone = firm.timezone || 'America/New_York';
  const hasAnything =
    data.rows.some((r) => r.status === 'active' || r.status === 'escalated' || r.status === 'paused') ||
    data.counts.sent > 0;

  if (!hasAnything) {
    return (
      <div className="flex min-h-0 flex-col lg:h-full">
        <ChaseSummary firmId={firmId} settings={settings} timezone={timezone} role={role} />
        <ChaseEmpty />
      </div>
    );
  }

  const selectedRow = selectedId ? data.byId.get(selectedId) ?? null : null;

  return (
    <div className="flex min-h-0 flex-col lg:h-full">
      <ChaseSummary firmId={firmId} settings={settings} timezone={timezone} role={role} />

      {/* The tab strip needs ~348px and this column gave it 315, so `Sent`
          scrolled out of its own overflow box — present in the DOM, unreachable
          by pointer. `flex-wrap` on the strip is the guarantee (counts reach
          three digits in April, and no fixed width survives that); the wider
          cap just keeps the common case on one line. `minmax(0,1fr)` stops the
          detail pane's min-content from clawing that width back. */}
      <div className="min-h-0 lg:grid lg:flex-1 lg:grid-cols-[minmax(320px,380px)_minmax(0,1fr)]">
        <div
          className={cn(
            'flex min-h-0 flex-col border-line lg:border-r',
            '[&_[role=tablist]]:flex-wrap [&_[role=tablist]]:gap-y-1',
            pane === 'detail' && 'hidden lg:flex',
          )}
        >
          <ChaseList
            tab={tab}
            onTabChange={onTabChange}
            byTab={data.byTab}
            counts={data.counts}
            selectedId={selectedId}
            onSelect={onSelect}
            settings={settings}
            timezone={timezone}
          />
        </div>

        <div className={cn('flex min-h-0 flex-col', pane === 'list' && 'hidden lg:flex')}>
          <button
            type="button"
            onClick={() => setPane('list')}
            className="flex items-center gap-1.5 border-b border-line px-4 py-2.5 text-2xs font-medium text-ink-muted lg:hidden"
          >
            <ArrowLeft className="size-3.5" /> Back to list
          </button>
          {selectedRow ? (
            <ChaseDetail
              key={selectedRow.client.id}
              row={selectedRow}
              firmId={firmId}
              firmName={firm.branding?.displayName || firm.name}
              settings={settings}
              timezone={timezone}
              role={role}
            />
          ) : (
            <NoSelection />
          )}
        </div>
      </div>
    </div>
  );
}

function NoSelection() {
  return (
    <div className="hidden h-full place-items-center p-8 text-center lg:grid">
      <div className="max-w-xs text-ink-faint">
        <MousePointerClick className="mx-auto mb-3 size-6" />
        <p className="text-[13px]">Pick a client to see the next message and its delivery history.</p>
      </div>
    </div>
  );
}

function ChaseError() {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 py-16">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-3 grid size-11 place-items-center rounded-lg bg-status-danger-wash text-status-danger">
          <AlertTriangle className="size-5" />
        </span>
        <p className="text-sm font-semibold text-ink">The chase console didn't load</p>
        <p className="mt-1 text-sm text-ink-muted">Usually a dropped connection. Reload to try again.</p>
        <Button variant="secondary" className="mt-5" onClick={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    </div>
  );
}
