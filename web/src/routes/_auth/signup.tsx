import { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { signUp } from '@/lib/authActions';
import { createFirm, defaultTaxYear, defaultTimezone } from '@/lib/firm';
import { firebaseErrorMessage } from '@/lib/errors';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { toast } from '@/components/ui/Toast';

export const Route = createFileRoute('/_auth/signup')({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [firmName, setFirmName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      await signUp(name, email, password);
    } catch (err) {
      setError(firebaseErrorMessage(err));
      setBusy(false);
      return;
    }

    // The account exists and is signed in. Provision the firm, but don't strand
    // the new user if the callable isn't deployed in this environment yet —
    // they land on the workspace-setup state instead of a raw error.
    try {
      await createFirm({
        name: firmName.trim(),
        timezone: defaultTimezone(),
        taxYear: defaultTaxYear(),
      });
      await auth.currentUser?.getIdToken(true);
    } catch {
      toast.message('You\u2019re signed in', {
        description: 'Finish setting up your workspace to get started.',
      });
    }

    await navigate({ to: '/' });
  }

  return (
    <div>
      <header>
        <h1 className="display text-3xl text-ink">Create your workspace</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Free while you file this season. No card required.
        </p>
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

        <Field label="Your name">
          <Input
            name="name"
            autoComplete="name"
            autoFocus
            required
            placeholder="Dana Okafor"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>

        <Field label="Firm name">
          <Input
            name="organization"
            autoComplete="organization"
            required
            placeholder="Okafor & Associates"
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
          />
        </Field>

        <Field label="Work email">
          <Input
            type="email"
            name="email"
            autoComplete="email"
            required
            placeholder="you@firm.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field label="Password" hint="At least 8 characters.">
          <Input
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        <Button type="submit" variant="primary" loading={busy} className="mt-1 w-full">
          Create workspace
          <ArrowRight className="size-4" />
        </Button>
      </form>

      <p className="mt-6 text-pretty text-center text-2xs/relaxed text-ink-faint">
        By creating a workspace you agree to the Terms of Service and Privacy Policy.
      </p>

      <p className="mt-6 text-center text-sm text-ink-muted">
        Already have a workspace?{' '}
        <Link to="/login" className="rounded-xs font-medium text-ink underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
