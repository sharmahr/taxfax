import { Stamp } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Separator } from '@/components/ui/Separator';
import { NavLink } from './NavLink';
import { NAV_ITEMS } from './nav';
import { WorkspaceSwitcher } from './WorkspaceSwitcher';
import { UserMenu } from './UserMenu';

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={cn('flex h-9 items-center', collapsed ? 'justify-center' : 'px-1')}>
      <span className="inline-flex size-7 items-center justify-center rounded-md bg-stamp text-paper">
        <Stamp className="size-4" />
      </span>
      {collapsed ? null : (
        <span className="display ml-2 text-lg leading-none text-ink">TaxFax</span>
      )}
    </div>
  );
}

/** Shared body — rendered directly in the desktop rail and inside the mobile Sheet. */
export function SidebarContent({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col gap-1 p-2">
      <Brand collapsed={collapsed} />
      <WorkspaceSwitcher collapsed={collapsed} />
      <Separator className="my-1" />
      <nav className="flex flex-1 flex-col gap-0.5">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            icon={item.icon}
            label={item.label}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ))}
      </nav>
      <Separator className="my-1" />
      <UserMenu collapsed={collapsed} />
    </div>
  );
}

/** The desktop rail. Width animates between expanded and icon-only. */
export function Sidebar({ collapsed }: { collapsed: boolean }) {
  return (
    <aside
      className="hidden h-full shrink-0 border-r border-line bg-paper transition-[width] duration-200 ease-out-quint md:block"
      style={{ width: collapsed ? 60 : 240 }}
    >
      <SidebarContent collapsed={collapsed} />
    </aside>
  );
}
