import { createFileRoute } from '@tanstack/react-router';
import { useAuth } from '@/lib/auth';
import { usePageTitle } from '@/components/shell';

export const Route = createFileRoute('/_app/')({
  component: Dashboard,
});

function Dashboard() {
  usePageTitle('Dashboard');
  const { activeFirm } = useAuth();
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="display text-3xl text-ink">{activeFirm?.firm?.name ?? 'Your firm'}</h1>
      <p className="mt-2 text-sm text-ink-muted">Your season dashboard lands here.</p>
    </div>
  );
}
