import { createFileRoute } from '@tanstack/react-router';
import { Check } from 'lucide-react';
import { ROLE_RANK, type Firm } from '@taxfax/shared';
import { useAuth } from '@/lib/auth';
import { fullDate } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { SettingsHeader } from '@/components/settings/layout';

export const Route = createFileRoute('/_app/settings/billing')({
  component: BillingPage,
});

type TierId = 'solo' | 'firm' | 'multi';

interface Tier {
  id: TierId;
  name: string;
  price: number;
  tagline: string;
  features: string[];
}

const TIERS: Tier[] = [
  {
    id: 'solo',
    name: 'Solo',
    price: 249,
    tagline: 'A solo preparer or a two-person shop.',
    features: [
      '1 staff seat',
      'Up to 250 returns a season',
      'Email & SMS chase',
      'Automatic renaming of every upload',
    ],
  },
  {
    id: 'firm',
    name: 'Firm',
    price: 549,
    tagline: 'A growing practice with a real team.',
    features: [
      'Up to 8 staff seats',
      'Up to 1,000 returns a season',
      'Checklist templates & prior-year import',
      'Priority email support',
    ],
  },
  {
    id: 'multi',
    name: 'Multi',
    price: 899,
    tagline: 'Several offices, one book of clients.',
    features: [
      'Unlimited staff seats',
      'Up to 2,500 returns a season',
      'Multiple office locations',
      'A named onboarding specialist',
    ],
  },
];

const PLAN_LABEL: Record<Firm['plan'], string> = {
  trial: 'Free trial',
  solo: 'Solo',
  firm: 'Firm',
  multi: 'Multi',
};

function contactHref(firmName: string, subject: string): string {
  const params = new URLSearchParams({ subject: `${subject} — ${firmName}` });
  return `mailto:billing@taxfax.xyz?${params.toString()}`;
}

function BillingPage() {
  const { activeFirm } = useAuth();
  const firm = activeFirm?.firm;
  const isOwner = activeFirm ? ROLE_RANK[activeFirm.role] >= ROLE_RANK.owner : false;

  if (!firm) return <BillingSkeleton />;

  const onTrial = firm.plan === 'trial';
  const currentTier: TierId = firm.plan === 'trial' ? 'firm' : firm.plan;

  return (
    <div>
      <SettingsHeader
        title="Billing"
        description="TaxFax is billed annually by invoice — there's no card on file and nothing auto-charges. Changing tiers is a conversation, not a checkout."
      />

      <div className="mt-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface-sunken/50 px-4 py-3.5">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-ink">Current plan</p>
              <StatusPill tone={onTrial ? 'info' : 'success'} dot>
                {PLAN_LABEL[firm.plan]}
              </StatusPill>
            </div>
            <p className="mt-1 text-2xs text-ink-faint">
              {onTrial ? (
                firm.trialEndsAt ? (
                  <>Your trial runs through {fullDate(firm.trialEndsAt)}.</>
                ) : (
                  <>You're on the free trial.</>
                )
              ) : (
                <>
                  <span className="tabular-nums">{firm.seats}</span>{' '}
                  {firm.seats === 1 ? 'seat' : 'seats'} included.
                </>
              )}
            </p>
          </div>
          {isOwner ? (
            <Button variant="secondary" size="sm" asChild>
              <a href={contactHref(firm.name, 'Billing question')}>Talk to us</a>
            </Button>
          ) : (
            <p className="text-2xs text-ink-faint">Your firm owner manages billing.</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {TIERS.map((tier) => {
            const current = tier.id === currentTier && !onTrial;
            const recommended = onTrial && tier.id === 'firm';
            return (
              <div
                key={tier.id}
                className={cn(
                  'flex flex-col rounded-xl border p-5',
                  current || recommended
                    ? 'border-line-strong bg-surface shadow-sm'
                    : 'border-line bg-surface',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="display text-xl text-ink">{tier.name}</h3>
                  {current ? (
                    <StatusPill tone="success">Current</StatusPill>
                  ) : recommended ? (
                    <StatusPill tone="neutral">Suggested</StatusPill>
                  ) : null}
                </div>

                <p className="mt-1 text-2xs leading-relaxed text-ink-faint">{tier.tagline}</p>

                <p className="mt-4 flex items-baseline gap-1">
                  <span className="display text-3xl tabular-nums text-ink">${tier.price}</span>
                  <span className="text-2xs text-ink-faint">/ month</span>
                </p>

                <ul className="mt-4 space-y-2 border-t border-line pt-4">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-2xs text-ink-muted">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-stamp-ink" />
                      <span className="text-pretty">{f}</span>
                    </li>
                  ))}
                </ul>

                <div className="mt-5 pt-1">
                  {current ? (
                    <Button variant="ghost" size="sm" disabled className="w-full">
                      Your current plan
                    </Button>
                  ) : isOwner ? (
                    <Button variant={recommended ? 'primary' : 'secondary'} size="sm" asChild className="w-full">
                      <a href={contactHref(firm.name, `Move to ${tier.name}`)}>
                        {onTrial ? `Choose ${tier.name}` : `Switch to ${tier.name}`}
                      </a>
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-2xs leading-relaxed text-ink-faint">
          Prices are per firm, per month, billed annually. Seasonal practices can pause between
          filing seasons — email{' '}
          <a
            href={contactHref(firm.name, 'Billing question')}
            className="rounded-xs font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline"
          >
            billing@taxfax.xyz
          </a>{' '}
          and a human will sort it out.
        </p>
      </div>
    </div>
  );
}

function BillingSkeleton() {
  return (
    <div>
      <Skeleton className="h-8 w-40" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      <div className="mt-8 space-y-6">
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-72 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
