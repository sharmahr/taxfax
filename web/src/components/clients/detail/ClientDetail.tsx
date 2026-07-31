import { useMemo, useState, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { collection, orderBy, query } from 'firebase/firestore';
import {
  paths,
  type Client,
  type ClientStage,
  type DocRequest,
  type StoredDocument,
} from '@taxfax/shared';
import { db } from '@/lib/firebase';
import { useCollection, useDoc } from '@/lib/firestore';
import { useAuth } from '@/lib/auth';
import { usePageTitle } from '@/components/shell';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { UserX } from 'lucide-react';
import { useMediaQuery, useMembers } from '../hooks';
import { chaseSummary, derive, type ClientDoc } from '../model';
import { pauseChase, resumeChase, runChase, startChase } from '../chase';
import { ChaseSendDialog } from '../ChaseSendDialog';
import { DetailHeader } from './DetailHeader';
import { DetailSummary } from './DetailSummary';
import { Checklist } from './Checklist';
import { Documents } from './Documents';
import { ChasePanel } from './ChasePanel';
import { AddRequestDialog } from './AddRequestDialog';

const CHASEABLE: ClientStage[] = ['not_started', 'awaiting', 'partial', 'blocked'];

export function ClientDetail({ clientId }: { clientId: string }) {
  const { activeFirm } = useAuth();
  const firmId = activeFirm?.firmId ?? null;
  const profileId = activeFirm?.firm?.chase.profile ?? 'standard';
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  const { data: client, loading } = useDoc<Client>(firmId ? paths.client(firmId, clientId) : null);
  const requestsQuery = useMemo(
    () => (firmId ? query(collection(db, paths.requests(firmId, clientId)), orderBy('order')) : null),
    [firmId, clientId],
  );
  const documentsQuery = useMemo(
    () =>
      firmId ? query(collection(db, paths.documents(firmId, clientId)), orderBy('uploadedAt', 'desc')) : null,
    [firmId, clientId],
  );
  const { data: requests } = useCollection<DocRequest>(requestsQuery);
  const { data: documents } = useCollection<StoredDocument>(documentsQuery);
  const members = useMembers(firmId);

  const [addOpen, setAddOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [chaseBusy, setChaseBusy] = useState(false);

  usePageTitle(client?.displayName ?? 'Client');

  if (loading && !client) return <DetailSkeleton />;
  if (!client) return <NotFound />;

  const c = client as ClientDoc;
  const d = derive(c);
  const chase = chaseSummary(d);
  const chaseable = CHASEABLE.includes(c.stage);
  const chaseStatus = c.chase?.status;
  const nextOrder = requests.reduce((max, r) => Math.max(max, r.order), 0) + 1;

  const mutateChase = async (work: Promise<unknown>, success: string) => {
    setChaseBusy(true);
    await runChase(work, success);
    setChaseBusy(false);
  };
  const startChasing = () =>
    void mutateChase(startChase({ firmId: firmId!, clientId }), `Now chasing ${c.displayName}`);
  const pause = () =>
    void mutateChase(pauseChase({ firmId: firmId!, clientId }), `Snoozed ${c.displayName} — reminders paused`);
  const resume = () =>
    void mutateChase(resumeChase({ firmId: firmId!, clientId }), `Resumed chasing ${c.displayName}`);
  const openSend = () => setSendOpen(true);
  // Idle clients have nothing to send yet — begin the cadence instead.
  const primaryChase = chaseStatus === 'idle' ? startChasing : openSend;

  const checklist = (
    <Checklist firmId={firmId!} clientId={clientId} requests={requests} documents={documents} />
  );
  const docs = <Documents documents={documents} />;
  const chasePanel = (
    <ChasePanel
      client={c}
      chase={chase}
      documents={documents}
      profileId={profileId}
      chaseable={chaseable}
      busy={chaseBusy}
      onStart={startChasing}
      onSendChase={openSend}
      onPause={pause}
      onResume={resume}
    />
  );

  return (
    <div className="rise-in mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <DetailHeader
        d={d}
        members={members}
        firmId={firmId!}
        chaseable={chaseable}
        sendLabel={chaseStatus === 'idle' ? 'Start chase' : 'Send chase'}
        onSendChase={primaryChase}
        onAddRequest={() => setAddOpen(true)}
      />

      <div className="mt-5">
        <DetailSummary d={d} chase={chase} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <Tabs defaultValue="checklist">
            <TabsList>
              <TabsTrigger value="checklist">
                Checklist
                {d.stillNeeded > 0 ? <Count>{d.stillNeeded}</Count> : null}
              </TabsTrigger>
              <TabsTrigger value="documents">
                Documents
                {documents.length > 0 ? <Count>{documents.length}</Count> : null}
              </TabsTrigger>
              {!isDesktop ? <TabsTrigger value="activity">Activity</TabsTrigger> : null}
            </TabsList>
            <TabsContent value="checklist">{checklist}</TabsContent>
            <TabsContent value="documents">{docs}</TabsContent>
            {!isDesktop ? <TabsContent value="activity">{chasePanel}</TabsContent> : null}
          </Tabs>
        </div>

        {isDesktop ? <aside className="lg:sticky lg:top-6 lg:self-start">{chasePanel}</aside> : null}
      </div>

      <AddRequestDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        firmId={firmId!}
        clientId={clientId}
        taxYear={c.taxYear}
        nextOrder={nextOrder}
      />

      <ChaseSendDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        firmId={firmId!}
        clients={[{ id: c.id, displayName: c.displayName }]}
      />
    </div>
  );
}

function Count({ children }: { children: ReactNode }) {
  return <span className="ml-1.5 tabular-nums text-2xs font-normal text-ink-faint">{children}</span>;
}

function NotFound() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <EmptyState
        icon={UserX}
        title="Client not found"
        description="This client may have been archived, or it belongs to a different workspace."
        action={
          <Button variant="secondary" asChild>
            <Link to="/clients">Back to all clients</Link>
          </Button>
        }
      />
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <Skeleton className="h-3 w-20" />
      <div className="mt-3 flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-3 w-52" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>
      <Skeleton className="mt-5 h-24 w-full rounded-xl" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-80 w-full rounded-xl" />
        <Skeleton className="hidden h-80 w-full rounded-xl lg:block" />
      </div>
    </div>
  );
}
