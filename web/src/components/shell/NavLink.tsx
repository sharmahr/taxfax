import type { ComponentType } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { cn } from '@/lib/cn';
import { Tooltip } from '@/components/ui/Tooltip';

interface NavLinkProps {
  /** May point at a route another agent owns; matched at runtime, so it is cast. */
  to: string;
  icon: ComponentType<{ className?: string }>;
  label: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}

/**
 * Sidebar navigation row. Active state is computed from the pathname rather than
 * the typed matcher, so links to sections other agents own still light up.
 */
export function NavLink({ to, icon: Icon, label, collapsed = false, onNavigate }: NavLinkProps) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active = to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`);

  const link = (
    <Link
      to={to as never}
      onClick={onNavigate}
      data-active={active || undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group/nav relative flex h-9 items-center gap-2.5 rounded-md text-sm font-medium',
        'transition-colors duration-100 ease-out-quint',
        collapsed ? 'justify-center px-0' : 'px-2.5',
        active
          ? 'bg-surface-sunken text-ink'
          : 'text-ink-muted hover:bg-surface-sunken/60 hover:text-ink',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute left-0 h-4 w-0.5 rounded-full bg-ink transition-opacity duration-100',
          active ? 'opacity-100' : 'opacity-0',
        )}
      />
      <Icon className="size-[1.05rem] shrink-0" />
      {collapsed ? null : <span className="truncate">{label}</span>}
    </Link>
  );

  return collapsed ? (
    <Tooltip content={label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}
