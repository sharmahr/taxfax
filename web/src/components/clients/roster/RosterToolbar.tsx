import type { RefObject } from 'react';
import { ArrowUpDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { fieldStyles } from '@/components/ui/Input';
import { Kbd } from '@/components/ui/Kbd';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import type { MemberDoc } from '../hooks';
import { LENSES, SORTS, type Lens, type RosterFilter, type SortKey } from '../model';

interface RosterToolbarProps {
  filter: RosterFilter;
  counts: Record<Lens, number>;
  members: MemberDoc[];
  tags: string[];
  matched: number;
  total: number;
  filtered: boolean;
  searchRef: RefObject<HTMLInputElement | null>;
  onSearch: (v: string) => void;
  onLens: (l: Lens) => void;
  onSort: (s: SortKey) => void;
  onAssignee: (a: RosterFilter['assignee']) => void;
  onTag: (t: string) => void;
  onClear: () => void;
}

export function RosterToolbar(props: RosterToolbarProps) {
  const { filter, counts, members, tags, matched, total, filtered } = props;
  const sortLabel = SORTS.find((s) => s.id === filter.sort)?.label ?? '';

  return (
    <div className="shrink-0 space-y-2.5 border-b border-line px-3 py-2.5">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-faint" />
          <input
            ref={props.searchRef}
            type="search"
            value={filter.search}
            onChange={(e) => props.onSearch(e.target.value)}
            placeholder="Search clients, emails, tags…"
            aria-label="Search clients"
            className={cn(fieldStyles, 'h-9 w-full pl-9 pr-12 text-sm', '[&::-webkit-search-cancel-button]:appearance-none')}
          />
          {filter.search ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => props.onSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-faint transition-colors hover:text-ink"
            >
              <X className="size-4" />
            </button>
          ) : (
            <Kbd className="absolute right-2.5 top-1/2 -translate-y-1/2">/</Kbd>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="secondary" className="shrink-0">
              <ArrowUpDown className="size-3.5" />
              <span className="hidden sm:inline">{sortLabel}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Sort by</DropdownMenuLabel>
            {SORTS.map((s) => (
              <DropdownMenuItem
                key={s.id}
                onSelect={() => props.onSort(s.id)}
                className={cn(filter.sort === s.id && 'font-medium text-ink')}
              >
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {members.length > 1 ? (
          <Select
            value={filter.assignee}
            onValueChange={(v) => props.onAssignee(v as RosterFilter['assignee'])}
          >
            <SelectTrigger className="hidden w-36 shrink-0 sm:flex" aria-label="Filter by owner">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.uid} value={m.uid}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}

        {tags.length > 0 ? (
          <Select value={filter.tag} onValueChange={props.onTag}>
            <SelectTrigger className="hidden w-32 shrink-0 lg:flex" aria-label="Filter by tag">
              <SelectValue placeholder="All tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {tags.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">
                  {t.replace(/-/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Client views"
          className="flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-lg bg-surface-sunken p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {LENSES.map((l) => {
            const active = filter.lens === l.id;
            const count = counts[l.id];
            return (
              <button
                key={l.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => props.onLens(l.id)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors duration-100 ease-out-quint',
                  active ? 'bg-paper text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
                )}
              >
                {l.label}
                <span
                  className={cn(
                    'tabular-nums text-2xs',
                    active ? 'text-ink-muted' : 'text-ink-faint',
                    l.id === 'attention' && count > 0 && 'text-status-danger',
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {filtered ? (
            <Button size="sm" variant="ghost" onClick={props.onClear} className="hidden sm:inline-flex">
              Clear
            </Button>
          ) : null}
          <span className="hidden tabular-nums text-2xs text-ink-faint sm:inline">
            {matched === total ? `${total} clients` : `${matched} of ${total}`}
          </span>
        </div>
      </div>
    </div>
  );
}
