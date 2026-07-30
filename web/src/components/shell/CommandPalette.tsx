import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { collection, limit, orderBy, query } from 'firebase/firestore';
import { Clock, Moon, Search, User } from 'lucide-react';
import { paths, type Client } from '@taxfax/shared';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/auth';
import { useCollection } from '@/lib/firestore';
import { getRecents, pushRecent, useCommandRegistry, type CommandDef } from '@/lib/command';
import { useTheme } from '@/lib/theme';
import { Kbd } from '@/components/ui/Kbd';
import { NAV_ITEMS } from './nav';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * ⌘K palette. Deliberately unanimated — it is a keyboard action and must feel
 * instant. `Clients` reads live; `Actions`/custom groups come from the command
 * registry so other surfaces contribute without touching this file.
 */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { activeFirm, signOut } = useAuth();
  const { setTheme, resolvedTheme } = useTheme();
  const { commands } = useCommandRegistry();
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) setSearch('');
  }, [open]);

  const firmId = activeFirm?.firmId ?? null;
  const clientsQuery = useMemo(
    () =>
      open && firmId
        ? query(collection(db, paths.clients(firmId)), orderBy('updatedAt', 'desc'), limit(50))
        : null,
    [open, firmId],
  );
  const { data: clients } = useCollection<Client>(clientsQuery);

  const recents = useMemo(() => (open ? getRecents() : []), [open]);

  const go = (to: string) => {
    onOpenChange(false);
    navigate({ to: to as never });
  };

  const openClient = (client: Client & { id: string }) => {
    const to = `/clients/${client.id}`;
    pushRecent({ id: client.id, label: client.displayName, to });
    go(to);
  };

  // Registry commands, grouped by their declared group (usually "Actions").
  const grouped = useMemo(() => {
    const map = new Map<string, CommandDef[]>();
    for (const c of commands) {
      const list = map.get(c.group) ?? [];
      list.push(c);
      map.set(c.group, list);
    }
    for (const list of map.values()) list.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    return [...map.entries()];
  }, [commands]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content
          aria-label="Command menu"
          className="fixed left-1/2 top-[14vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-surface-raised shadow-xl outline-hidden"
        >
          <DialogPrimitive.Title className="sr-only">Command menu</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Search clients, run actions, and jump between sections.
          </DialogPrimitive.Description>
          <Command
            label="Command menu"
            className="[&_[cmdk-group-heading]]:label-eyebrow [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3"
          >
            <div className="flex items-center gap-2.5 border-b border-line px-3.5">
              <Search className="size-4 shrink-0 text-ink-faint" />
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder="Search clients, actions, sections…"
                className="h-12 w-full bg-transparent text-sm text-ink outline-hidden placeholder:text-ink-faint"
              />
              <Kbd>Esc</Kbd>
            </div>

            <Command.List className="max-h-[min(60vh,26rem)] overflow-y-auto overflow-x-hidden p-2">
              <Command.Empty className="py-10 text-center text-sm text-ink-muted">
                No matches. Try a client name or an action.
              </Command.Empty>

              {!search && recents.length > 0 ? (
                <Command.Group heading="Recent">
                  {recents.map((r) => (
                    <PaletteItem key={r.id} value={`recent ${r.label}`} onSelect={() => go(r.to)}>
                      <Clock />
                      <span className="truncate">{r.label}</span>
                    </PaletteItem>
                  ))}
                </Command.Group>
              ) : null}

              {clients.length > 0 ? (
                <Command.Group heading="Clients">
                  {clients.map((c) => (
                    <PaletteItem
                      key={c.id}
                      value={`client ${c.displayName} ${c.primaryContact?.email ?? ''}`}
                      onSelect={() => openClient(c)}
                    >
                      <User />
                      <span className="truncate">{c.displayName}</span>
                    </PaletteItem>
                  ))}
                </Command.Group>
              ) : null}

              {grouped.map(([group, list]) => (
                <Command.Group key={group} heading={group}>
                  {list.map((cmd) => (
                    <PaletteItem
                      key={cmd.id}
                      value={`${group} ${cmd.label} ${(cmd.keywords ?? []).join(' ')}`}
                      onSelect={() => {
                        onOpenChange(false);
                        cmd.run();
                      }}
                    >
                      {cmd.icon ? <cmd.icon /> : null}
                      <span className="truncate">{cmd.label}</span>
                    </PaletteItem>
                  ))}
                </Command.Group>
              ))}

              <Command.Group heading="Navigation">
                {NAV_ITEMS.map((item) => (
                  <PaletteItem
                    key={item.to}
                    value={`go ${item.label}`}
                    onSelect={() => go(item.to)}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </PaletteItem>
                ))}
              </Command.Group>

              <Command.Group heading="Preferences">
                <PaletteItem
                  value="toggle theme dark light"
                  onSelect={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                >
                  <Moon />
                  <span>Toggle {resolvedTheme === 'dark' ? 'light' : 'dark'} theme</span>
                </PaletteItem>
                <PaletteItem
                  value="sign out log out"
                  onSelect={() => {
                    onOpenChange(false);
                    void signOut();
                  }}
                >
                  <User />
                  <span>Sign out</span>
                </PaletteItem>
              </Command.Group>
            </Command.List>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function PaletteItem({
  value,
  onSelect,
  children,
}: {
  value: string;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex cursor-default select-none items-center gap-2.5 rounded-sm px-2.5 py-2 text-sm text-ink outline-hidden data-[selected=true]:bg-surface-sunken [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-faint"
    >
      {children}
    </Command.Item>
  );
}
