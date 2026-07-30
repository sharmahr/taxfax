import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { CheckCircle2, Stamp, TriangleAlert } from 'lucide-react';
import { paths, ROLE_LABEL, type Invite } from '@taxfax/shared';
import { useDoc } from '@/lib/firestore';
import { useAuth } from '@/lib/auth';
import { signUp } from '@/lib/authActions';
import { acceptInvite } from '@/lib/firm';
import { firebaseErrorMessage } from '@/lib/errors';
import { auth } from '@/lib/firebase';
import { toDate } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';

export const Route = createFileRoute('/invite/$token')({
  component: InvitePage,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-paper">
      <header className="mx-auto flex max-w-5xl items-center px-6 py-6">
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex size-7 items-center justify-center rounded-md bg-stamp text-paper">
            <Stamp className="size-4" />
          </span>
          <span className="display text-lg leading-none text-ink">TaxFax</span>
        </span>
      </header>
      <main className="flex items-center justify-center px-6 pb-20 pt-6">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

function Invalid({ title, body }: { title: string; body: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-5 inline-flex size-11 items-center justify-center rounded-lg bg-status-warn-wash text-status-warn">
        <TriangleAlert className="size-5" />
      </div>
      <h1 className="display text-3xl text-ink">{title}</h1>
      <p className="mx-auto mt-3 max-w-sm text-pretty text-sm/relaxed text-ink-muted">{body}</p>
      <Button asChild variant="secondary" className="mt-6">
        <Link to="/login">Go to sign in</Link>
      </Button>
    </div>
  );
}

function InvitePage() {
  const { token } = Route.useParams();
  const { data: invite, loading } = useDoc<Invite>(paths.invite(token));
  const { user } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-muted">
          <Spinner className="size-4" />
          Looking up your invitation&hellip;
        </div>
      </Shell>
    );
  }

  const expired = invite ? toDate(invite.expiresAt).getTime() < Date.now() : false;
  if (!invite || invite.status !== 'pending' || expired) {
    return (
      <Shell>
        <Invalid
          title={invite && invite.status === 'accepted' ? 'Already accepted' : 'Invitation unavailable'}
          body={
            invite && invite.status === 'accepted'
              ? 'This invitation has already been used. Sign in to reach the workspace.'
              : 'This invitation link is no longer valid. Ask your firm admin to send a fresh one.'
          }
        />
      </Shell>
    );
  }

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      if (!user) {
        await signUp(name, invite!.email, password);
      }
      await acceptInvite(token);
      await auth.currentUser?.getIdToken(true);
      await navigate({ to: '/' });
    } catch (err) {
      setError(firebaseErrorMessage(err));
      setBusy(false);
    }
  }

  const mismatch = user && user.email?.toLowerCase() !== invite.email.toLowerCase();

  return (
    <Shell>
      <p className="label-eyebrow text-ink-faint">You&rsquo;ve been invited</p>
      <h1 className="display mt-3 text-balance text-4xl leading-tight text-ink">
        Join {invite.firmName}
      </h1>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
        <span>{invite.invitedByName} added you as</span>
        <Badge>{ROLE_LABEL[invite.role]}</Badge>
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-6 rounded-md border border-status-danger/25 bg-status-danger-wash px-3 py-2 text-sm text-status-danger"
        >
          {error}
        </p>
      ) : null}

      {user ? (
        <div className="mt-8">
          {mismatch ? (
            <p className="mb-4 rounded-md border border-status-warn/25 bg-status-warn-wash px-3 py-2 text-sm text-status-warn">
              This invite was sent to {invite.email}, but you&rsquo;re signed in as {user.email}.
              Accepting will add it to your current account.
            </p>
          ) : (
            <p className="mb-4 text-sm text-ink-muted">
              Signed in as <span className="font-medium text-ink">{user.email}</span>.
            </p>
          )}
          <Button variant="primary" loading={busy} className="w-full" onClick={accept}>
            <CheckCircle2 className="size-4" />
            Accept invitation
          </Button>
        </div>
      ) : (
        <form
          className="mt-8 flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void accept();
          }}
        >
          <Field label="Email">
            <Input value={invite.email} readOnly className="text-ink-muted" />
          </Field>
          <Field label="Your name">
            <Input
              autoComplete="name"
              autoFocus
              required
              placeholder="Dana Okafor"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Password" hint="At least 8 characters.">
            <Input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Button type="submit" variant="primary" loading={busy} className="mt-1 w-full">
            Accept &amp; create account
          </Button>
          <p className="text-center text-sm text-ink-muted">
            Already have an account?{' '}
            <Link to="/login" className="rounded-xs font-medium text-ink underline-offset-4 hover:underline">
              Sign in first
            </Link>
          </p>
        </form>
      )}
    </Shell>
  );
}
