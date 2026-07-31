import { useEffect, useRef, useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
} from 'firebase/auth';
import { MailCheck, ShieldCheck, Stamp, TriangleAlert } from 'lucide-react';
import { getAuthSnapshot, useAuth } from '@/lib/auth';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { claimPortalAccess, portalErrorMessage } from '@/components/portal/portalApi';

export const Route = createFileRoute('/portal/enter')({
  component: PortalEnter,
});

const MAGIC_EMAIL_KEY = 'taxfax.magicEmail';

type Phase = 'working' | 'need-email' | 'error' | 'sent';

function storedEmail(): string {
  const fromQuery = new URLSearchParams(window.location.search).get('email');
  if (fromQuery) return fromQuery.trim();
  return window.localStorage.getItem(MAGIC_EMAIL_KEY)?.trim() ?? '';
}

function PortalEnter() {
  const navigate = useNavigate();
  const { claims } = useAuth();

  const [phase, setPhase] = useState<Phase>('working');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ran = useRef(false);

  // The moment the portal claim lands in the token, we're in.
  useEffect(() => {
    if (claims?.portal) navigate({ to: '/portal', replace: true });
  }, [claims, navigate]);

  async function finishClaim(): Promise<void> {
    await claimPortalAccess();
    // Force the freshly-granted claim into the ID token; the auth listener then
    // updates the snapshot, and the effect above redirects to the list.
    if (auth.currentUser) await auth.currentUser.getIdToken(true);
  }

  async function run(withEmail?: string): Promise<void> {
    setError(null);
    setPhase('working');
    try {
      const isLink = isSignInWithEmailLink(auth, window.location.href);
      if (isLink && !auth.currentUser) {
        const e = withEmail ?? storedEmail();
        if (!e) {
          setPhase('need-email');
          return;
        }
        await signInWithEmailLink(auth, e, window.location.href);
        window.localStorage.removeItem(MAGIC_EMAIL_KEY);
      }

      if (!auth.currentUser) {
        setPhase('error');
        setError('This secure link has expired or was already used. We can send you a new one.');
        return;
      }

      await finishClaim();
      // Redirect is handled by the claims effect once the token refreshes.
    } catch (err) {
      setPhase('error');
      setError(portalErrorMessage(err));
    }
  }

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    // Already a taxpayer on this device? The claims effect will redirect.
    if (getAuthSnapshot().claims?.portal) return;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function sendFreshLink(target: string): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await sendSignInLinkToEmail(auth, target, {
        url: `${window.location.origin}/portal/enter`,
        handleCodeInApp: true,
      });
      window.localStorage.setItem(MAGIC_EMAIL_KEY, target);
      setPhase('sent');
    } catch (err) {
      setError(portalErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2">
          <span className="inline-flex size-7 items-center justify-center rounded-md bg-stamp text-white">
            <Stamp className="size-4" aria-hidden />
          </span>
          <span className="display text-lg leading-none text-ink">TaxFax</span>
        </div>

        {phase === 'working' ? (
          <div className="rise-in" role="status" aria-live="polite">
            <div className="flex items-center gap-3">
              <Spinner className="size-5 text-ink-faint" />
              <p className="text-sm text-ink-muted">Signing you in securely…</p>
            </div>
            <p className="mt-4 text-pretty text-sm text-ink-faint">
              No password needed — the link in your message is your key.
            </p>
          </div>
        ) : null}

        {phase === 'need-email' ? (
          <form
            className="rise-in"
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) void run(email.trim());
            }}
          >
            <h1 className="display text-3xl text-ink">Confirm your email</h1>
            <p className="mt-2 text-pretty text-sm/relaxed text-ink-muted">
              This link didn&rsquo;t carry your email, so we need it once to confirm it&rsquo;s you.
              Enter the address your accountant sent this to — that&rsquo;s the only thing we check,
              no password.
            </p>
            <Field className="mt-5" label="Email address" error={error ?? undefined}>
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Button type="submit" variant="primary" className="mt-4 w-full" disabled={!email.trim()}>
              Continue
            </Button>
          </form>
        ) : null}

        {phase === 'error' ? (
          <div className="rise-in">
            <div className="mb-4 inline-flex size-11 items-center justify-center rounded-lg bg-status-warn-wash text-status-warn">
              <TriangleAlert className="size-5" aria-hidden />
            </div>
            <h1 className="display text-3xl text-ink">Let&rsquo;s get you a fresh link</h1>
            <p className="mt-2 text-pretty text-sm/relaxed text-ink-muted">
              {error ?? 'This secure link has expired.'}
            </p>
            <form
              className="mt-5"
              onSubmit={(e) => {
                e.preventDefault();
                if (email.trim()) void sendFreshLink(email.trim());
              }}
            >
              <Field label="Your email address">
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Button
                type="submit"
                variant="primary"
                loading={busy}
                className="mt-4 w-full"
                disabled={!email.trim()}
              >
                Email me a new link
              </Button>
            </form>
          </div>
        ) : null}

        {phase === 'sent' ? (
          <div className="rise-in">
            <div className="mb-4 inline-flex size-11 items-center justify-center rounded-lg bg-status-success-wash text-status-success">
              <MailCheck className="size-5" aria-hidden />
            </div>
            <h1 className="display text-3xl text-ink">Check your email</h1>
            <p className="mt-2 text-pretty text-sm/relaxed text-ink-muted">
              We sent a secure link to <span className="font-medium text-ink">{email}</span>. Open it
              on this device and you&rsquo;re in — no password to remember.
            </p>
          </div>
        ) : null}

        <p className="mt-10 flex items-center gap-1.5 text-2xs text-ink-faint">
          <ShieldCheck className="size-3.5" aria-hidden />
          Your documents are private to you and your accountant.
        </p>
      </div>
    </div>
  );
}
