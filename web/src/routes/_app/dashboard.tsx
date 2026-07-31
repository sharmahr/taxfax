import { useMemo } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { Check } from 'lucide-react';
import { collection, collectionGroup, limit, orderBy, query, where } from 'firebase/firestore';
import { paths, type Activity, type Client, type DocRequest, type StoredDocument } from '@taxfax/shared';
import { db } from '@/lib/firebase';
import { useCollection } from '@/lib/firestore';
import { useAuth } from '@/lib/auth';
import { useCommand } from '@/lib/command';
import { usePageTitle } from '@/components/shell';
import {
  ActivityRail,
  ClientList,
  DashboardEmpty,
  DashboardSkeleton,
  ReviewCard,
  Section,
  SeasonHeader,
  SeasonStanding,
  TriageRow,
  dashboardNow,
  deriveDashboard,
  seasonClock,
  type SeasonPhase,
} from '@/components/dashboard';

/**
 * `asof` is honoured only by `dashboardNow`, and only in a dev build. It moves
 * the whole screen — header and worklist together — so a demo can never show a
 * date the rest of the page disagrees with.
 */
interface DashboardSearch {
  asof?: string;
}

export const Route = createFileRoute('/_app/dashboard')({
  validateSearch: (search: Record<string, unknown>): DashboardSearch =>
    typeof search.asof === 'string' ? { asof: search.asof } : {},
  component: DashboardScreen,
});

const viewAllClass =
  'text-2xs font-medium text-ink-muted underline-offset-4 outline-none transition-colors hover:text-ink hover:underline focus-visible:text-ink focus-visible:underline';

function DashboardScreen() {
  usePageTitle('Overview');
  const navigate = useNavigate();
  const { asof } = Route.useSearch();
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
    firmId ? query(collection(db, paths.activity(firmId)), orderBy('at', 'desc'), limit(30)) : null,
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

  // One clock for the whole screen. The date in the header and the ages in the
  // worklist are read off the same instant, so they cannot contradict.
  const clock = useMemo(
    () => seasonClock(firm?.taxYear ?? new Date().getFullYear() - 1, dashboardNow(asof)),
    [firm?.taxYear, asof],
  );

  const model = useMemo(
    () => deriveDashboard(clients.data, requests.data, reviewDocs.data, clock.today, clock.phase),
    [clients.data, requests.data, reviewDocs.data, clock],
  );

  const nameById = useMemo(
    () => new Map(clients.data.map((c) => [c.id, c.displayName] as const)),
    [clients.data],
  );

  if (!firmId || !firm || clients.loading) return <DashboardSkeleton />;
  if (clients.data.length === 0) return <DashboardEmpty firmName={firm.name} />;

  const {
    needsYouNow,
    oneDocAway,
    silent,
    ready,
    inReview,
    neverStarted,
    reviewCount,
    reviewClients,
    reviewTopClients,
    headline,
    counts,
  } = model;
  const offSeason = clock.phase !== 'filing';
  const nothingToDo =
    needsYouNow.length === 0 &&
    oneDocAway.length === 0 &&
    silent.length === 0 &&
    ready.length === 0 &&
    reviewCount === 0 &&
    !(offSeason && (inReview.length > 0 || neverStarted.length > 0));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <SeasonHeader firmName={firm.name} clock={clock} headline={headline} />

      <div className="mt-8 grid gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex min-w-0 flex-col gap-8">
          {offSeason && <SeasonStanding clock={clock} counts={counts} />}

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
              <ClientList clients={ready} />
            </Section>
          )}

          {/* Out of season these two are the work. In season the chase already
              covers them, and they would crowd the returns with a deadline. */}
          {offSeason && inReview.length > 0 && (
            <Section title="Everything's in, sitting with a preparer" count={inReview.length}>
              <ClientList clients={inReview} />
            </Section>
          )}

          {offSeason && neverStarted.length > 0 && (
            <Section
              title="No checklist yet"
              count={neverStarted.length}
              action={
                neverStarted.length > 6 ? (
                  <Link to="/clients" className={viewAllClass}>
                    View all
                  </Link>
                ) : undefined
              }
            >
              <ClientList clients={neverStarted} />
            </Section>
          )}

          {nothingToDo && <AllClear phase={clock.phase} seasonYear={clock.seasonYear} />}
        </div>

        <aside className="min-w-0">
          <ActivityRail items={activity.data} clientName={(id) => nameById.get(id)} />
        </aside>
      </div>
    </div>
  );
}

const ALL_CLEAR: Record<SeasonPhase, (seasonYear: number) => { title: string; body: string }> = {
  filing: () => ({
    title: "You're ahead of the chase.",
    body: 'Nothing is blocking a return right now. New uploads and replies land here the moment they arrive.',
  }),
  extension: () => ({
    title: 'Nothing is waiting on you today.',
    body: 'Every open return has what it needs for now. Anything that comes back before the extended deadline shows up here.',
  }),
  offseason: (seasonYear) => ({
    title: `Season ${seasonYear} is put to bed.`,
    body: 'Nothing is outstanding. January starts from a clean list — and anything a client sends late still lands here.',
  }),
  preseason: (seasonYear) => ({
    title: 'Nothing is due yet.',
    body: `Season ${seasonYear} opens in January. Checklists you build now go out the day you're ready.`,
  }),
};

/** Clients exist, but the worklist is empty — a genuinely good state, said warmly. */
function AllClear({ phase, seasonYear }: { phase: SeasonPhase; seasonYear: number }) {
  const { title, body } = ALL_CLEAR[phase](seasonYear);

  return (
    <div className="rounded-xl border border-line bg-surface px-5 py-10 text-center">
      <span className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-surface-sunken text-status-success">
        <Check className="size-5" />
      </span>
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-xs text-pretty text-[13px] leading-relaxed text-ink-muted">{body}</p>
    </div>
  );
}
