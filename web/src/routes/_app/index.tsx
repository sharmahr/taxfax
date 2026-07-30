import { useMemo } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { ArrowUpRight, Check } from 'lucide-react';
import { collection, collectionGroup, limit, orderBy, query, where } from 'firebase/firestore';
import { paths, type Activity, type Client, type DocRequest, type StoredDocument } from '@taxfax/shared';
import { db } from '@/lib/firebase';
import { useCollection } from '@/lib/firestore';
import { useAuth } from '@/lib/auth';
import { useCommand } from '@/lib/command';
import { usePageTitle } from '@/components/shell';
import {
  ActivityRail,
  DashboardEmpty,
  DashboardSkeleton,
  ReviewCard,
  Section,
  SeasonHeader,
  TriageRow,
  deriveDashboard,
  seasonClock,
} from '@/components/dashboard';

export const Route = createFileRoute('/_app/')({
  component: DashboardScreen,
});

const viewAllClass =
  'text-2xs font-medium text-ink-muted underline-offset-4 outline-none transition-colors hover:text-ink hover:underline focus-visible:text-ink focus-visible:underline';

function DashboardScreen() {
  usePageTitle('Overview');
  const navigate = useNavigate();
  const { activeFirm } = useAuth();
  const firmId = activeFirm?.firmId ?? null;
  const firm = activeFirm?.firm ?? null;

  const clients = useCollection<Client>(
    firmId ? query(collection(db, paths.clients(firmId)), orderBy('sortName')) : null,
  );
  const requests = useCollection<DocRequest>(
    firmId ? query(collectionGroup(db, 'requests'), where('firmId', '==', firmId)) : null,
  );
  const reviewDocs = useCollection<StoredDocument>(
    firmId
      ? query(collectionGroup(db, 'documents'), where('firmId', '==', firmId), where('state', '==', 'needs_review'))
      : null,
  );
  const activity = useCollection<Activity>(
    firmId ? query(collection(db, paths.activity(firmId)), orderBy('at', 'desc'), limit(12)) : null,
  );

  useCommand({
    id: 'nav-review',
    group: 'Go to',
    label: 'Review queue',
    keywords: ['documents', 'classify'],
    run: () => navigate({ to: '/review' }),
  });
  useCommand({
    id: 'nav-chase',
    group: 'Go to',
    label: 'Chase console',
    keywords: ['reminders', 'cadence'],
    run: () => navigate({ to: '/chase' }),
  });

  const model = useMemo(
    () => deriveDashboard(clients.data, requests.data, reviewDocs.data, new Date()),
    [clients.data, requests.data, reviewDocs.data],
  );

  if (!firmId || !firm || clients.loading) return <DashboardSkeleton />;
  if (clients.data.length === 0) return <DashboardEmpty firmName={firm.name} />;

  const { today, deadline, daysToDeadline } = seasonClock(firm.taxYear);
  const { needsYouNow, oneDocAway, silent, ready, reviewCount, reviewClients, reviewTopClients, headline } = model;
  const nothingToDo =
    needsYouNow.length === 0 &&
    oneDocAway.length === 0 &&
    silent.length === 0 &&
    ready.length === 0 &&
    reviewCount === 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <SeasonHeader
        firmName={firm.name}
        taxYear={firm.taxYear}
        daysToDeadline={daysToDeadline}
        deadline={deadline}
        today={today}
        headline={headline}
      />

      <div className="mt-8 grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-w-0 flex-col gap-8">
          {needsYouNow.length > 0 && (
            <Section title="Needs you now" count={needsYouNow.length}>
              <ol className="mt-1">
                {needsYouNow.map((item, i) => (
                  <TriageRow key={item.client.id} item={item} firmId={firmId} rank={i + 1} />
                ))}
              </ol>
            </Section>
          )}

          {reviewCount > 0 && (
            <ReviewCard count={reviewCount} clients={reviewClients} topClients={reviewTopClients} />
          )}

          {oneDocAway.length > 0 && (
            <Section title="One document from done" count={oneDocAway.length}>
              <ul className="mt-1">
                {oneDocAway.map((item) => (
                  <TriageRow key={item.client.id} item={item} firmId={firmId} />
                ))}
              </ul>
            </Section>
          )}

          {silent.length > 0 && (
            <Section
              title="Gone silent"
              count={silent.length}
              action={
                silent.length > 6 ? (
                  <Link to="/chase" className={viewAllClass}>
                    View all
                  </Link>
                ) : undefined
              }
            >
              <ul className="mt-1">
                {silent.slice(0, 6).map((item) => (
                  <TriageRow key={item.client.id} item={item} firmId={firmId} />
                ))}
              </ul>
            </Section>
          )}

          {ready.length > 0 && (
            <Section
              title="Ready to prepare"
              count={ready.length}
              action={
                ready.length > 6 ? (
                  <Link to="/clients" className={viewAllClass}>
                    View all
                  </Link>
                ) : undefined
              }
            >
              <ul className="mt-1 grid gap-x-8 sm:grid-cols-2">
                {ready.slice(0, 6).map((c) => (
                  <li key={c.id}>
                    <a
                      href={`/clients/${c.id}`}
                      className="group/ready -mx-2.5 flex items-center justify-between gap-3 rounded-lg px-2.5 py-2 text-sm text-ink outline-none transition-colors hover:bg-surface-sunken/60 focus-visible:bg-surface-sunken/60"
                    >
                      <span className="truncate font-medium">{c.displayName}</span>
                      <ArrowUpRight className="size-3.5 shrink-0 text-ink-faint transition-colors group-hover/ready:text-ink" />
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {nothingToDo && <AllClear />}
        </div>

        <aside className="min-w-0">
          <ActivityRail items={activity.data} />
        </aside>
      </div>
    </div>
  );
}

/** Clients exist, but the worklist is empty — a genuinely good state, said warmly. */
function AllClear() {
  return (
    <div className="rounded-xl border border-line bg-surface px-5 py-10 text-center">
      <span className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-surface-sunken text-status-success">
        <Check className="size-5" />
      </span>
      <p className="text-sm font-semibold text-ink">You're ahead of the chase.</p>
      <p className="mx-auto mt-1 max-w-xs text-pretty text-[13px] leading-relaxed text-ink-muted">
        Nothing is blocking a return right now. New uploads and replies land here the moment they arrive.
      </p>
    </div>
  );
}
