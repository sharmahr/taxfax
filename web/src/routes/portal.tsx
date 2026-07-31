import { createFileRoute, Outlet } from '@tanstack/react-router';
import { authReady } from '@/lib/auth';
import { PortalLocaleProvider, usePortalLocale } from '@/components/portal/locale';

/**
 * The portal lives entirely outside the firm shell — no sidebar, no workspace
 * switcher, nothing built for the preparer. Just a taxpayer, their list, and a
 * camera. We only wait for auth to resolve here; the gate lives on the index so
 * the unauthenticated `/portal/enter` handshake can still run.
 *
 * This is also where the taxpayer's language takes effect: the provider resolves
 * their locale and this shell stamps `lang`/`dir` onto the subtree, so Arabic
 * lays out right-to-left and the platform picks the right CJK/Arabic fallback
 * font — no webfont shipped to the very users we are trying not to slow down.
 */
export const Route = createFileRoute('/portal')({
  beforeLoad: async () => {
    await authReady();
  },
  component: PortalLayout,
});

function PortalLayout() {
  return (
    <PortalLocaleProvider>
      <PortalShell />
    </PortalLocaleProvider>
  );
}

function PortalShell() {
  const { lang, dir } = usePortalLocale();
  return (
    <div lang={lang} dir={dir} className="min-h-dvh bg-paper text-ink">
      <Outlet />
    </div>
  );
}
