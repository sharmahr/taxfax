import { useState } from 'react';
import { createFileRoute, Link, Outlet, useRouterState } from '@tanstack/react-router';
import {
  ArrowRight,
  Bell,
  Building2,
  CreditCard,
  ListChecks,
  Send,
  Users,
  X,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { useAuth } from '@/lib/auth';
import { usePageTitle } from '@/components/shell';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { setOnboardingDismissed } from '@/components/settings/api';
import { onboardingProgress } from '@/components/onboarding/steps';

export const Route = createFileRoute('/_app/settings')({
  component: SettingsLayout,
});

interface Section {
  to:
    | '/settings/profile'
    | '/settings/members'
    | '/settings/cadence'
    | '/settings/templates'
    | '/settings/notifications'
    | '/settings/billing';
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const SECTIONS: Section[] = [
  { to: '/settings/profile', label: 'Firm profile', icon: Building2 },
  { to: '/settings/members', label: 'Members & roles', icon: Users },
  { to: '/settings/cadence', label: 'Chase cadence', icon: Send },
  { to: '/settings/templates', label: 'Checklist templates', icon: ListChecks },
  { to: '/settings/notifications', label: 'Notifications', icon: Bell },
  { to: '/settings/billing', label: 'Plan & billing', icon: CreditCard },
];

function SettingsLayout() {
  usePageTitle('Settings');
  const { activeFirm } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <ResumeSetup firmId={activeFirm?.firmId} firm={activeFirm?.firm} />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
        <nav aria-label="Settings sections" className="lg:sticky lg:top-2 lg:self-start">
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {SECTIONS.map((s) => {
              const active = pathname === s.to || pathname.startsWith(`${s.to}/`);
              return (
                <li key={s.to} className="shrink-0">
                  <Link
                    to={s.to}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium',
                      'transition-colors duration-100 ease-out-quint',
                      active
                        ? 'bg-surface-sunken text-ink'
                        : 'text-ink-muted hover:bg-surface-sunken/60 hover:text-ink',
                    )}
                  >
                    <s.icon className="size-4 shrink-0" />
                    {s.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

/** A quiet, dismissible nudge back into the guided setup — never a blocker. */
function ResumeSetup({
  firmId,
  firm,
}: {
  firmId: string | undefined;
  firm: Parameters<typeof onboardingProgress>[0];
}) {
  const [hidden, setHidden] = useState(false);
  const progress = onboardingProgress(firm);
  if (!firmId || hidden || progress.complete || firm?.onboarding?.dismissed) return null;

  return (
    <div className="mb-8 flex flex-col gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">Finish setting up your firm</p>
        <div className="mt-2 flex items-center gap-3">
          <Progress
            value={(progress.completed / progress.total) * 100}
            className="h-1.5 w-32"
            aria-label={`Setup ${progress.completed} of ${progress.total} complete`}
          />
          <span className="text-2xs tabular-nums text-ink-faint">
            {progress.completed} of {progress.total} done
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <Button asChild variant="primary" size="sm">
          <Link to="/onboarding">
            Resume
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          aria-label="Hide setup reminder"
          onClick={() => {
            setHidden(true);
            if (firmId) void setOnboardingDismissed(firmId, true);
          }}
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
