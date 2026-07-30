import { useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { ROLE_LABEL } from '@taxfax/shared';
import { useAuth } from '@/lib/auth';
import { createFirm, defaultTaxYear, defaultTimezone } from '@/lib/firm';
import { firebaseErrorMessage } from '@/lib/errors';
import { initials } from '@/lib/format';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { toast } from '@/components/ui/Toast';

function FirmMark({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-ink text-2xs font-semibold text-paper',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function WorkspaceSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const { firms, activeFirm, setActiveFirm } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);

  const name = activeFirm?.firm?.name ?? 'New workspace';

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {collapsed ? (
            <button
              aria-label={`Workspace: ${name}. Switch workspace.`}
              className="mx-auto rounded-md outline-hidden focus-visible:ring-[3px] focus-visible:ring-focus/25"
            >
              <FirmMark name={name} />
            </button>
          ) : (
            <button className="group flex h-11 w-full items-center gap-2.5 rounded-lg px-2 text-left transition-colors duration-100 hover:bg-surface-sunken/60">
              <FirmMark name={name} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium text-ink">{name}</span>
                {activeFirm ? (
                  <span className="text-2xs text-ink-muted">{ROLE_LABEL[activeFirm.role]}</span>
                ) : null}
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-ink-faint" />
            </button>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
          {firms.map((ws) => (
            <DropdownMenuItem key={ws.firmId} onSelect={() => setActiveFirm(ws.firmId)}>
              <FirmMark name={ws.firm?.name ?? '?'} className="size-6" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm">{ws.firm?.name ?? 'Loading…'}</span>
                <span className="text-2xs text-ink-muted">{ROLE_LABEL[ws.role]}</span>
              </span>
              {ws.firmId === activeFirm?.firmId ? <Check className="size-4" /> : null}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
            <Plus />
            Create workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { setActiveFirm } = useAuth();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const { firmId } = await createFirm({
        name: name.trim(),
        timezone: defaultTimezone(),
        taxYear: defaultTaxYear(),
      });
      setActiveFirm(firmId);
      toast.success(`${name.trim()} is ready.`);
      onOpenChange(false);
      setName('');
    } catch (err) {
      setError(firebaseErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Create a workspace</DialogTitle>
            <DialogDescription>
              A workspace is one firm — its staff, clients, and templates, kept separate from every
              other.
            </DialogDescription>
          </DialogHeader>
          <Field label="Firm name" error={error ?? undefined}>
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Whitfield & Co."
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={busy} disabled={!name.trim()}>
              Create workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
