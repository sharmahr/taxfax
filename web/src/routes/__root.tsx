import { createRootRoute, Link, Outlet, useRouter } from '@tanstack/react-router';
import { FileWarning, RotateCw } from 'lucide-react';
import { AuthProvider } from '@/lib/auth';
import { TooltipProvider } from '@/components/ui/Tooltip';
import { Toaster } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

export const Route = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
  errorComponent: RootError,
});

function RootLayout() {
  return (
    <AuthProvider>
      <TooltipProvider delayDuration={250} skipDelayDuration={400}>
        <Outlet />
        <Toaster />
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
  return (
    <Centered>
      <p className="label-eyebrow text-ink-faint">Error 404</p>
      <h1 className="display mt-3 text-6xl text-ink">Not on file.</h1>
      <p className="mt-4 text-pretty text-sm text-ink-muted">
        We looked through the drawers and couldn&rsquo;t find that page. It may have been moved,
        filed, or never existed.
      </p>
      <div className="mt-7 flex justify-center">
        <Button asChild variant="primary">
          <Link to="/">Back to dashboard</Link>
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
