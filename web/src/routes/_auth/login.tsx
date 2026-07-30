import { useEffect, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ArrowRight, Mail } from 'lucide-react';
import { completeMagicLink, sendMagicLink, sendReset, signIn } from '@/lib/authActions';
import { firebaseErrorMessage } from '@/lib/errors';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { toast } from '@/components/ui/Toast';

export const Route = createFileRoute('/_auth/login')({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'password' | 'link'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkSent, setLinkSent] = useState(false);

  // Finish a passwordless sign-in if the visitor arrived from an email link.
  useEffect(() => {
    completeMagicLink()
      .then((done) => {
        if (done) void navigate({ to: '/' });
      })
      .catch((err) => setError(firebaseErrorMessage(err)));
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'password') {
        await signIn(email, password);
        await navigate({ to: '/' });
      } else {
        await sendMagicLink(email);
        setLinkSent(true);
        setBusy(false);
      }
    } catch (err) {
      setError(firebaseErrorMessage(err));
      setBusy(false);
    }
  }

  async function onForgot() {
    if (!email) {
      setError('Enter your email above first, then choose \u201CForgot password.\u201D');
      return;
    }
    try {
      await sendReset(email);
      toast.success('Reset link sent', { description: `Check ${email} to set a new password.` });
    } catch (err) {
      setError(firebaseErrorMessage(err));
    }
  }

  if (linkSent) {
    return (
      <div>
        <div className="mb-5 inline-flex size-11 items-center justify-center rounded-lg bg-stamp-wash text-stamp-ink">
          <Mail className="size-5" />
        </div>
        <h1 className="display text-3xl text-ink">Check your inbox</h1>
        <p className="mt-3 text-pretty text-sm/relaxed text-ink-muted">
          We sent a one-time sign-in link to <span className="font-medium text-ink">{email}</span>.
          Open it on this device to finish signing in.
        </p>
        <Button
          variant="ghost"
          className="mt-6 -ml-3"
          onClick={() => {
            setLinkSent(false);
            setMode('password');
          }}
        >
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <div>
      <header>
        <h1 className="display text-3xl text-ink">Sign in</h1>
        <p className="mt-2 text-sm text-ink-muted">Welcome back. Let&rsquo;s clear the queue.</p>
      </header>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4" noValidate>
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-status-danger/25 bg-status-danger-wash px-3 py-2 text-sm text-status-danger"
          >
            {error}
          </p>
        ) : null}

        <Field label="Email">
          <Input
            type="email"
            name="email"
            autoComplete="email"
            autoFocus
            required
            placeholder="you@firm.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        {mode === 'password' ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="login-password">Password</Label>
              <button
                type="button"
                onClick={onForgot}
                className="rounded-xs text-xs font-medium text-ink-faint transition-colors hover:text-ink"
              >
                Forgot?
              </button>
            </div>
            <Input
              id="login-password"
              type="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        ) : null}

        <Button type="submit" variant="primary" loading={busy} className="mt-1 w-full">
          {mode === 'password' ? (
            <>
              Sign in
              <ArrowRight className="size-4" />
            </>
          ) : (
            <>
              <Mail className="size-4" />
              Email me a sign-in link
            </>
          )}
        </Button>
      </form>

      <div className="mt-4 flex items-center gap-3 text-2xs text-ink-faint">
        <span className="h-px flex-1 bg-line" />
        OR
        <span className="h-px flex-1 bg-line" />
      </div>

      <Button
        variant="secondary"
        className="mt-4 w-full"
        onClick={() => {
          setError(null);
          setMode((m) => (m === 'password' ? 'link' : 'password'));
        }}
      >
        {mode === 'password' ? 'Sign in with an email link' : 'Sign in with a password'}
      </Button>

      <p className="mt-8 text-center text-sm text-ink-muted">
        New to TaxFax?{' '}
        <Link to="/signup" className="rounded-xs font-medium text-ink underline-offset-4 hover:underline">
          Create a workspace
        </Link>
      </p>
    </div>
  );
}
