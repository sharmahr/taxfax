import { lazy, Suspense } from 'react';
import { createRootRoute, Link, Outlet, useRouter, useRouterState } from '@tanstack/react-router';
import { FileWarning, RotateCw } from 'lucide-react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { CardVignette } from '@/components/brand';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { Button } from '@/components/ui/Button';

/**
 * Sonner is ~32 kB and the marketing page never raises a toast, so the toaster
 * is both split out and left unmounted there. It is a sibling of the outlet,
 * so gating it changes nothing about how routes mount.
 */
const Toaster = lazy(() => import('@/components/ui/Toast').then((m) => ({ default: m.Toaster })));

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
  errorComponent: RootError,
});

function RootLayout() {
  const onMarketing = useRouterState({ select: (s) => s.location.pathname === '/' });
  return (
    <AuthProvider>
      <TooltipProvider delayDuration={250} skipDelayDuration={400}>
        <Outlet />
        {onMarketing ? null : (
          <Suspense fallback={null}>
            <Toaster />
          </Suspense>
        )}
      </TooltipProvider>
    </AuthProvider>
  );
}

/** A filing-cabinet page, not a cartoon. Big serif code, one line of plain guidance. */
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6 text-center">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}

function NotFound() {
  // A signed-in preparer who mistypes a URL should land back at work, not on a
  // marketing page inviting them to start a trial they already started.
  const { user } = useAuth();
  return (
    <Centered>
      <div className="flex justify-center">
        <CardVignette className="w-40 text-ink-faint" />
      </div>
      <p className="label-eyebrow mt-8 text-ink-faint">Error 404</p>
      <h1 className="display mt-3 text-6xl text-ink">Not on file.</h1>
      <p className="mt-4 text-pretty text-sm text-ink-muted">
        We looked through the drawers and couldn&rsquo;t find that page. It may have been moved,
        filed, or never existed.
      </p>
      <div className="mt-7 flex justify-center">
        <Button asChild variant="primary">
          {user ? <Link to="/dashboard">Back to dashboard</Link> : <Link to="/">Back to home</Link>}
        </Button>
      </div>
    </Centered>
  );
}

function RootError({ error }: { error: Error }) {
  const router = useRouter();
  return (
    <Centered>
      <div className="mx-auto mb-5 inline-flex size-12 items-center justify-center rounded-lg bg-status-danger-wash text-status-danger">
        <FileWarning className="size-6" />
      </div>
      <h1 className="display text-4xl text-ink">Something jammed.</h1>
      <p className="mt-3 text-pretty text-sm text-ink-muted">
        An unexpected error stopped this view from loading. Nothing was lost — retry, and if it
        keeps happening, reload the app.
      </p>
      {error.message ? (
        <p className="mt-4 rounded-md border border-line bg-surface-sunken px-3 py-2 text-left font-mono text-2xs text-ink-muted">
          {error.message}
        </p>
      ) : null}
      <div className="mt-7 flex justify-center gap-2">
        <Button variant="primary" onClick={() => router.invalidate()}>
          <RotateCw className="size-4" />
          Try again
        </Button>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Reload app
        </Button>
      </div>
    </Centered>
  );
}
