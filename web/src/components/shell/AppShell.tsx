import { useEffect, useState, type ReactNode } from 'react';
import { CommandProvider } from '@/lib/command';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/Sheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { Sidebar, SidebarContent } from './Sidebar';
import { Topbar } from './Topbar';
import { CommandPalette } from './CommandPalette';
import { PageTitleProvider } from './pageTitle';

const SIDEBAR_KEY = 'taxfax.sidebar';

function readCollapsed(): boolean {
  return typeof localStorage !== 'undefined' && localStorage.getItem(SIDEBAR_KEY) === '1';
}

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <CommandProvider>
      <PageTitleProvider>
        <div className="flex h-dvh w-full overflow-hidden bg-paper">
          <Sidebar collapsed={collapsed} />

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" showClose={false} className="w-64 p-0" aria-describedby={undefined}>
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="flex min-w-0 flex-1 flex-col">
            <Topbar
              onOpenMobileNav={() => setMobileOpen(true)}
              onToggleSidebar={() => setCollapsed((c) => !c)}
              onOpenPalette={() => setPaletteOpen(true)}
            />
            <main className="@container/main flex-1 overflow-y-auto">{children}</main>
          </div>
        </div>

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </PageTitleProvider>
    </CommandProvider>
  );
}

/** Chrome-shaped skeleton for the authed loading state — never a full-page spinner. */
export function ShellSkeleton() {
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-paper">
      <div className="hidden w-60 shrink-0 flex-col gap-2 border-r border-line p-2 md:flex">
        <div className="flex h-9 items-center gap-2 px-1">
          <Skeleton className="size-7 rounded-md" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-11 w-full rounded-lg" />
        <div className="my-1 h-px bg-line" />
        <div className="flex flex-col gap-1.5 pt-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-md" />
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 items-center gap-3 border-b border-line px-4">
          <Skeleton className="size-8 rounded-md" />
          <div className="flex-1" />
          <Skeleton className="hidden h-9 w-56 rounded-md md:block" />
          <Skeleton className="size-8 rounded-md" />
        </div>
        <div className="flex-1 p-6">
          <div className="mx-auto max-w-5xl space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}
