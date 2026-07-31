import { Clock, Send, UserCog, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Avatar } from '@/components/ui/Avatar';
import type { MemberDoc } from '../hooks';

interface BulkBarProps {
  count: number;
  members: MemberDoc[];
  onAssign: (uid: string | null) => void;
  onSendChase: () => void;
  onSnooze: () => void;
  onClear: () => void;
}

export function BulkBar({ count, members, onAssign, onSendChase, onSnooze, onClear }: BulkBarProps) {
  const visible = count > 0;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center px-4">
      <div
        role="toolbar"
        aria-label="Bulk actions"
        aria-hidden={!visible}
        className={cn(
          'pointer-events-auto flex items-center gap-2 rounded-xl border border-line-strong bg-surface-raised p-1.5 pl-3 shadow-lg',
          'transition duration-200 ease-out-quint',
          visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
        )}
      >
        <span className="flex items-center gap-1.5 text-sm text-ink">
          <span className="tabular-nums font-semibold">{count}</span>
          <span className="text-ink-muted">selected</span>
        </span>
        <span className="mx-1 h-5 w-px bg-line" aria-hidden />

        <Button size="sm" variant="primary" onClick={onSendChase} disabled={!visible}>
          <Send className="size-3.5" />
          Send chase
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="secondary" disabled={!visible}>
              <UserCog className="size-3.5" />
              Assign
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center" className="max-h-72 overflow-y-auto">
            <DropdownMenuLabel>Assign to</DropdownMenuLabel>
            {members.map((m) => (
              <DropdownMenuItem key={m.uid} onSelect={() => onAssign(m.uid)}>
                <Avatar name={m.name} size="sm" />
                <span className="truncate">{m.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onAssign(null)}>Unassign</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button size="sm" variant="secondary" onClick={onSnooze} disabled={!visible}>
          <Clock className="size-3.5" />
          Snooze
        </Button>

        <Button size="sm" variant="ghost" iconOnly onClick={onClear} aria-label="Clear selection" disabled={!visible}>
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
