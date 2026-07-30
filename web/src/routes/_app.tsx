import { useEffect, useState } from 'react';
import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router';
import { Building2, Plus } from 'lucide-react';
import { authReady, getAuthSnapshot, useAuth } from '@/lib/auth';
import { AppShell, ShellSkeleton } from '@/components/shell';
import { CreateWorkspaceDialog } from '@/components/shell/WorkspaceSwitcher';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export const Route = createFileRoute('/_app')({
  beforeLoad: async () => {
    await authReady();
    if (!getAuthSnapshot().user) {
      throw redirect({ to: '/login' });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, firms } = useAuth();
  const navigate = useNavigate();

  // Sign-out happens inside the shell; bounce to login the moment the user clears.
  useEffect(() => {
    if (!loading && !user) navigate({ to: '/login' });
  }, [loading, user, navigate]);

  if (loading || !user) return <ShellSkeleton />;
  if (firms.length === 0) return <NoWorkspace />;

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

/** Authed, but not attached to a firm yet — the signup-without-provisioning path. */
function NoWorkspace() {
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-6">
      <div className="w-full max-w-md">
        <EmptyState
          icon={Building2}
          title="No workspace yet"
          description="Your account isn't attached to a firm. Create one to start collecting documents, or ask a colleague to resend your invitation."
          action={
            <div className="flex items-center justify-center gap-2">
              <Button variant="primary" onClick={() => setOpen(true)}>
                <Plus className="size-4" />
                Create workspace
              </Button>
              <Button variant="ghost" onClick={() => void signOut()}>
                Sign out
              </Button>
            </div>
          }
        />
      </div>
      <CreateWorkspaceDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
