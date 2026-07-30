import { Link } from '@tanstack/react-router';
import { LogOut, Settings } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Avatar } from '@/components/ui/Avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';

export function UserMenu({ collapsed = false }: { collapsed?: boolean }) {
  const { user, signOut } = useAuth();
  const name = user?.displayName || user?.email?.split('@')[0] || 'Account';
  const email = user?.email ?? '';
  const photo = user?.photoURL ?? undefined;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {collapsed ? (
          <button
            aria-label="Account menu"
            className="mx-auto rounded-full outline-hidden focus-visible:ring-[3px] focus-visible:ring-focus/25"
          >
            <Avatar name={name} src={photo} size="sm" />
          </button>
        ) : (
          <button className="flex h-11 w-full items-center gap-2.5 rounded-lg px-2 text-left transition-colors duration-100 hover:bg-surface-sunken/60">
            <Avatar name={name} src={photo} size="sm" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium text-ink">{name}</span>
              <span className="truncate text-2xs text-ink-muted">{email}</span>
            </span>
          </button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="top" sideOffset={8} className="w-60">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <Avatar name={name} src={photo} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{name}</p>
            <p className="truncate text-2xs text-ink-muted">{email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to={'/settings' as never}>
            <Settings />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="danger" onSelect={() => void signOut()}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
