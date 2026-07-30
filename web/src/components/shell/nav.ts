import { Files, LayoutDashboard, LayoutTemplate, Send, Settings, Users } from 'lucide-react';

/** The single source of navigation truth — the sidebar and the palette both read it. */
export const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/documents', label: 'Documents', icon: Files },
  { to: '/chase', label: 'Chase', icon: Send },
  { to: '/templates', label: 'Templates', icon: LayoutTemplate },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const;
