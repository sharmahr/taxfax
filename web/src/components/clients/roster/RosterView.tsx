import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { collection, orderBy, query } from 'firebase/firestore';
import type { Client } from '@taxfax/shared';
import { db } from '@/lib/firebase';
import { useCollection } from '@/lib/firestore';
import { useAuth } from '@/lib/auth';
import { pushRecent } from '@/lib/command';
import { toast } from '@/components/ui/Toast';
import { paths } from '@taxfax/shared';
import { useMediaQuery, useMembers } from '../hooks';
import { bulkAssign, run } from '../actions';
import { bulkPause } from '../chase';
import { ChaseSendDialog } from '../ChaseSendDialog';
import {
  buildRoster,
  derive,
  lensCounts,
  type DerivedClient,
  type Lens,
  type RosterFilter,
  type SortKey,
} from '../model';
import { RosterToolbar } from './RosterToolbar';
import { RosterTable } from './RosterTable';
import { RosterCards } from './RosterCards';
import { BulkBar } from './BulkBar';
import { CaughtUp, EmptyRoster, NoResults, RosterSkeleton } from './RosterStates';

const INITIAL_FILTER: RosterFilter = {
  search: '',
  lens: 'all',
  sort: 'urgent',
  assignee: 'all',
  tag: 'all',
};

export function RosterView() {
  const { activeFirm } = useAuth();
  const firmId = activeFirm?.firmId ?? null;
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 767px)');

  const clientsQuery = useMemo(
    () => (firmId ? query(collection(db, paths.clients(firmId)), orderBy('sortName')) : null),
    [firmId],
  );
  const { data: clients, loading } = useCollection<Client>(clientsQuery);
  const members = useMembers(firmId);

  const [filter, setFilter] = useState<RosterFilter>(INITIAL_FILTER);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [bulkSendOpen, setBulkSendOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const derived = useMemo<DerivedClient[]>(() => clients.map(derive), [clients]);
  const byId = useMemo(() => new Map(derived.map((d) => [d.client.id, d])), [derived]);
  const counts = useMemo(() => lensCounts(derived), [derived]);
  const tags = useMemo(
    () => [...new Set(derived.flatMap((d) => d.client.tags ?? []))].sort(),
    [derived],
  );

  const result = useMemo(() => buildRoster(derived, filter), [derived, filter]);
  const orderedIds = useMemo(
    () => result.rows.flatMap((r) => (r.type === 'client' ? [r.d.client.id] : [])),
    [result],
  );
  const visibleSet = useMemo(() => new Set(result.visibleIds), [result.visibleIds]);

  const filtered =
    filter.search !== '' || filter.lens !== 'all' || filter.assignee !== 'all' || filter.tag !== 'all';
  // A search / tag / assignee narrowing with nothing behind it reads as "no matches".
  // An empty *lens* while clients live in other lenses is the good "all caught up" case.
  const narrowedBySearch =
    filter.search !== '' || filter.assignee !== 'all' || filter.tag !== 'all';

  // Selection is a set, so it survives filtering; "select all" targets what's visible.
  const selectedVisible = result.visibleIds.filter((id) => selection.has(id)).length;
  const allSelected = result.visibleIds.length > 0 && selectedVisible === result.visibleIds.length;
  const someSelected = selectedVisible > 0 && !allSelected;

  // Drop the keyboard cursor if the row it pointed at was filtered away.
  useEffect(() => {
    if (activeId && !visibleSet.has(activeId)) setActiveId(null);
  }, [activeId, visibleSet]);

  const patch = (p: Partial<RosterFilter>) => setFilter((f) => ({ ...f, ...p }));
  const clearFilters = () => setFilter((f) => ({ ...INITIAL_FILTER, sort: f.sort }));
  const clearSelection = () => setSelection(new Set());

  const toggleSelect = (id: string) =>
    setSelection((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelection((prev) => {
      const next = new Set(prev);
      if (allSelected) result.visibleIds.forEach((id) => next.delete(id));
      else result.visibleIds.forEach((id) => next.add(id));
      return next;
    });

  const open = (d: DerivedClient) => {
    pushRecent({ id: d.client.id, label: d.client.displayName, to: `/clients/${d.client.id}` });
    void navigate({ to: '/clients/$clientId', params: { clientId: d.client.id } });
  };

  // ── Keyboard: this is a screen these users live in. ──
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (typing) {
        if (e.key === 'Escape') (el as HTMLInputElement).blur();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (orderedIds.length === 0) return;
      const idx = activeId ? orderedIds.indexOf(activeId) : -1;
      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          setActiveId(orderedIds[Math.min(orderedIds.length - 1, idx + 1)] ?? orderedIds[0]);
          break;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          setActiveId(idx <= 0 ? orderedIds[0] : orderedIds[idx - 1]);
          break;
        case 'Enter': {
          if (!activeId) return;
          const d = byId.get(activeId);
          if (d) open(d);
          break;
        }
        case 'x':
          if (activeId) {
            e.preventDefault();
            toggleSelect(activeId);
          }
          break;
        case 'Escape':
          if (selection.size) clearSelection();
          else setActiveId(null);
          break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, orderedIds, byId, selection.size]);

  const selectedIds = useMemo(() => [...selection], [selection]);
  const selectedClients = useMemo(
    () => selectedIds.map((id) => ({ id, displayName: byId.get(id)?.client.displayName ?? 'this client' })),
    [selectedIds, byId],
  );

  const onBulkAssign = (uid: string | null) => {
    if (!firmId || selectedIds.length === 0) return;
    const who = uid ? members.byId.get(uid)?.name ?? 'a preparer' : 'no one';
    void run(bulkAssign(firmId, selectedIds, uid), {
      success: `Assigned ${selectedIds.length} ${selectedIds.length === 1 ? 'client' : 'clients'} to ${who}`,
    }).then((ok) => ok && clearSelection());
  };

  const onBulkSendChase = () => {
    if (!firmId || selectedIds.length === 0) return;
    setBulkSendOpen(true);
  };

  const onBulkSnooze = () => {
    if (!firmId || selectedIds.length === 0) return;
    void bulkPause(firmId, selectedIds).then(({ paused, skipped }) => {
      if (paused > 0)
        toast.success(`Snoozed ${paused} ${paused === 1 ? 'client' : 'clients'}`, {
          description: skipped > 0 ? `${skipped} weren’t being chased.` : 'Reminders pause until you resume.',
        });
      else
        toast.error('Nothing to snooze', {
          description: 'None of the selected clients were being actively chased.',
        });
      clearSelection();
    });
  };

  let body: ReactNode;
  if (loading && derived.length === 0) body = <RosterSkeleton />;
  else if (derived.length === 0)
    body = (
      <EmptyRoster
        onAddClient={() =>
          toast.info('Client import lives in onboarding', {
            description: 'Drop last year’s returns in and TaxFax builds every checklist for you.',
          })
        }
      />
    );
  else if (result.matched === 0)
    body = narrowedBySearch ? (
      <NoResults query={filter.search} onClear={clearFilters} />
    ) : (
      <CaughtUp lens={filter.lens} onClear={clearFilters} />
    );
  else if (isMobile)
    body = (
      <RosterCards
        rows={result.rows}
        members={members}
        selection={selection}
        onToggleSelect={toggleSelect}
        onOpen={open}
      />
    );
  else
    body = (
      <RosterTable
        rows={result.rows}
        members={members}
        selection={selection}
        activeId={activeId}
        allSelected={allSelected}
        someSelected={someSelected}
        sort={filter.sort}
        onSort={(s: SortKey) => patch({ sort: s })}
        onToggleAll={toggleAll}
        onToggleSelect={toggleSelect}
        onOpen={open}
        onActivate={setActiveId}
      />
    );

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <RosterToolbar
        filter={filter}
        counts={counts}
        members={members.list}
        tags={tags}
        matched={result.matched}
        total={derived.length}
        filtered={filtered}
        searchRef={searchRef}
        onSearch={(v) => patch({ search: v })}
        onLens={(l: Lens) => patch({ lens: l })}
        onSort={(s) => patch({ sort: s })}
        onAssignee={(a) => patch({ assignee: a })}
        onTag={(t) => patch({ tag: t })}
        onClear={clearFilters}
      />
      {body}
      <BulkBar
        count={selection.size}
        members={members.list}
        onAssign={onBulkAssign}
        onSendChase={onBulkSendChase}
        onSnooze={onBulkSnooze}
        onClear={clearSelection}
      />
      {firmId ? (
        <ChaseSendDialog
          open={bulkSendOpen}
          onOpenChange={setBulkSendOpen}
          firmId={firmId}
          clients={selectedClients}
          onSent={clearSelection}
        />
      ) : null}
    </div>
  );
}
