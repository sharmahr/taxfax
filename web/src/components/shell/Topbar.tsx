import { useRouterState } from '@tanstack/react-router';
import { Bell, Menu, PanelLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Kbd } from '@/components/ui/Kbd';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { Tooltip } from '@/components/ui/Tooltip';
import { ThemeToggle } from './ThemeToggle';
import { usePageTitleNode } from './pageTitle';
import { NAV_ITEMS } from './nav';

interface TopbarProps {
  onOpenMobileNav: () => void;
  onToggleSidebar: () => void;
  onOpenPalette: () => void;
}

export function Topbar({ onOpenMobileNav, onToggleSidebar, onOpenPalette }: TopbarProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const custom = usePageTitleNode();
  const derived = NAV_ITEMS.find(
    (i) => pathname === i.to || pathname.startsWith(`${i.to}/`),
  )?.label;

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-1.5 border-b border-line bg-paper/85 px-3 backdrop-blur-md md:px-4">
      <Button
        iconOnly
        size="sm"
        variant="ghost"
        className="md:hidden"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
      >
        <Menu />
      </Button>
      <Tooltip content="Toggle sidebar">
        <Button
          iconOnly
          size="sm"
          variant="ghost"
          className="hidden md:inline-flex"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <PanelLeft />
        </Button>
      </Tooltip>

      <div className="mx-1 min-w-0 flex-1 truncate text-sm font-semibold text-ink">
        {custom ?? derived}
      </div>

      <button
        onClick={onOpenPalette}
        className="group hidden h-9 w-56 items-center gap-2 rounded-md border border-line bg-surface px-3 text-sm text-ink-faint shadow-xs transition-colors duration-100 hover:border-line-strong md:flex"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search…</span>
        <Kbd>⌘K</Kbd>
      </button>
      <Button
        iconOnly
        size="sm"
        variant="ghost"
        className="md:hidden"
        onClick={onOpenPalette}
        aria-label="Search"
      >
        <Search />
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button iconOnly size="sm" variant="ghost" aria-label="Notifications">
            <Bell />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="border-b border-line px-3 py-2.5 text-sm font-semibold text-ink">
            Notifications
          </div>
          <p className="px-3 py-10 text-center text-sm text-ink-muted">You’re all caught up.</p>
        </PopoverContent>
      </Popover>

      <ThemeToggle />
    </header>
  );
}
