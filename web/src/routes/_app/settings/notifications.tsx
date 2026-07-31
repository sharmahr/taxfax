import { createFileRoute, Link } from '@tanstack/react-router';
import { Bell, Mail, MessageSquare, MoonStar, Reply, UserRoundCheck } from 'lucide-react';
import { CHASE_PROFILES, ROLE_RANK } from '@taxfax/shared';
import { useAuth } from '@/lib/auth';
import { StatusPill } from '@/components/ui/StatusPill';
import { Skeleton } from '@/components/ui/Skeleton';
import { SettingsHeader, SettingsSection } from '@/components/settings/layout';
import type { ReactNode } from 'react';

export const Route = createFileRoute('/_app/settings/notifications')({
  component: NotificationsPage,
});

function formatHour(h: number): string {
  const meridiem = h < 12 ? 'AM' : 'PM';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${meridiem}`;
}

function NotificationsPage() {
  const { activeFirm } = useAuth();
  const firm = activeFirm?.firm;
  const canEdit = activeFirm ? ROLE_RANK[activeFirm.role] >= ROLE_RANK.admin : false;

  if (!firm) return <NotificationsSkeleton />;

  const chase = firm.chase;
  const profile = CHASE_PROFILES[chase.profile];
  const replyTo = firm.branding.replyToEmail;

  return (
    <div>
      <SettingsHeader
        title="Notifications"
        description="Every message TaxFax sends on your behalf, to whom, and when. Nothing here fires without a reason you can see."
      />

      <div className="mt-8 space-y-8">
        <SettingsSection
          title="To your clients"
          description="The chase itself — reminders that a document is still outstanding."
        >
          <Row
            icon={chase.smsEnabled ? MessageSquare : Mail}
            title="Chase reminders"
            status={
              chase.enabled ? (
                <StatusPill tone="success" dot>
                  On
                </StatusPill>
              ) : (
                <StatusPill tone="warn" dot>
                  Paused
                </StatusPill>
              )
            }
          >
            {chase.enabled ? (
              <>
                Following the <span className="font-medium text-ink-muted">{profile.label}</span>{' '}
                cadence — email{chase.smsEnabled ? ' and SMS' : ' only'}, until every document is in.
              </>
            ) : (
              <>Paused for the whole firm — no client is being chased right now.</>
            )}{' '}
            <SettingLink to="/settings/cadence">
              {canEdit ? 'Edit in Chase cadence' : 'See Chase cadence'}
            </SettingLink>
          </Row>

          <Row icon={MoonStar} title="Quiet hours">
            No messages go out between{' '}
            <span className="font-medium text-ink-muted">{formatHour(chase.quietHours.start)}</span>{' '}
            and{' '}
            <span className="font-medium text-ink-muted">{formatHour(chase.quietHours.end)}</span>,
            {chase.sendOnWeekends ? ' and weekends are fair game.' : ' or on weekends.'}
          </Row>

          <Row icon={Reply} title="Where replies land">
            {replyTo ? (
              <>
                When a client replies to a reminder, it reaches{' '}
                <span className="font-medium text-ink-muted">{replyTo}</span>.
              </>
            ) : (
              <>No reply-to address is set yet, so client replies have nowhere to go.</>
            )}{' '}
            <SettingLink to="/settings/profile">
              {canEdit ? 'Change in Firm profile' : 'See Firm profile'}
            </SettingLink>
          </Row>
        </SettingsSection>

        <SettingsSection
          title="To your team"
          description="TaxFax hands a client back to a person the moment automation has done its job."
        >
          <Row icon={Bell} title="Heads-up">
            As the deadline nears and a client still hasn't sent everything, the assigned preparer
            gets a heads-up email — a chance to make a personal call before it's late.
          </Row>

          <Row icon={UserRoundCheck} title="Escalation">
            After the last reminder, TaxFax stops chasing and emails the assigned preparer to take
            over directly. You choose how many reminders come first.{' '}
            <SettingLink to="/settings/cadence">
              {canEdit ? 'Set the handoff in Chase cadence' : 'See Chase cadence'}
            </SettingLink>
          </Row>

          <p className="rounded-lg border border-line bg-surface-sunken/50 px-3.5 py-2.5 text-2xs leading-relaxed text-ink-faint">
            Team alerts always go to each client's assigned preparer. Per-person preferences and
            daily digests aren't available yet.
          </p>
        </SettingsSection>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  title,
  status,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  status?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-ink-faint">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-ink">{title}</p>
          {status}
        </div>
        <p className="mt-1 text-pretty text-2xs leading-relaxed text-ink-faint">{children}</p>
      </div>
    </div>
  );
}

function SettingLink({
  to,
  children,
}: {
  to: '/settings/cadence' | '/settings/profile';
  children: ReactNode;
}) {
  return (
    <Link
      to={to}
      className="rounded-xs font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline"
    >
      {children}
    </Link>
  );
}

function NotificationsSkeleton() {
  return (
    <div>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      <div className="mt-8 space-y-8">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-1 gap-x-10 gap-y-5 border-t border-line pt-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]"
          >
            <Skeleton className="h-4 w-32" />
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
