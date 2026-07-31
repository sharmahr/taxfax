import { Inbox, LayoutDashboard, Send, Settings, Users } from 'lucide-react';

/** The single source of navigation truth — the sidebar and the palette both read it. */
export const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/review', label: 'Review', icon: Inbox },
  { to: '/chase', label: 'Chase', icon: Send },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const;
