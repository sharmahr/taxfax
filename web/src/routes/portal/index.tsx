import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { collection, orderBy, query } from 'firebase/firestore';
import { Phone, ShieldCheck } from 'lucide-react';
import {
  paths,
  type Client,
  type DocRequest,
  type Firm,
  type StoredDocument,
} from '@taxfax/shared';
import { authReady, getAuthSnapshot, useAuth } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { useCollection, useDoc } from '@/lib/firestore';
import { Progress } from '@/components/ui/Progress';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { SealVignette } from '@/components/brand';
import {
  ChecklistItem,
  DocLine,
  UploadItemView,
} from '@/components/portal/ChecklistItem';
import { Uploader } from '@/components/portal/Uploader';
import { useUploads } from '@/components/portal/useUploads';
import { useRetract } from '@/components/portal/useRetract';
import { usePortalLocale } from '@/components/portal/locale';
import { LanguageMenu } from '@/components/portal/LanguageMenu';

export const Route = createFileRoute('/portal/')({
  beforeLoad: async () => {
    await authReady();
    const { user, claims } = getAuthSnapshot();
    if (!user || !claims?.portal) throw redirect({ to: '/portal/enter' });
  },
  component: PortalHome,
});

const SETTLED_DOC_STATES = new Set(['classified', 'needs_review', 'accepted']);

function PortalHome() {
  const { claims } = useAuth();
  const portal = claims?.portal;
  // beforeLoad guarantees this; the guard keeps the types honest.
  if (!portal) return null;
  return <PortalList firmId={portal.firmId} clientId={portal.clientId} />;
}

function usePointerCoarse(): boolean {
  const [coarse, setCoarse] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(pointer: coarse)');
    const on = () => setCoarse(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return coarse;
}

function formatUsPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  const ten = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (ten.length !== 10) return raw;
  return `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}`;
}

function isComplete(r: DocRequest): boolean {
  if (r.status === 'accepted') return true;
  if (r.status === 'received') return r.documentIds.length >= Math.max(1, r.expectedCount);
  return false;
}

function PortalList({ firmId, clientId }: { firmId: string; clientId: string }) {
  const coarse = usePointerCoarse();
  const { t, syncClientLanguage } = usePortalLocale();

  const firm = useDoc<Firm>(paths.firm(firmId));
  const client = useDoc<Client>(paths.client(firmId, clientId));

  // The taxpayer's language is something we already know — it was lifted off
  // last year's return. Feed it to the provider the moment the client doc lands,
  // unless they have overridden it on the portal this session.
  useEffect(() => {
    if (client.data) syncClientLanguage(client.data.language, firm.data ?? undefined);
  }, [client.data, firm.data, syncClientLanguage]);

  const requestsQuery = useMemo(
    () => query(collection(db, paths.requests(firmId, clientId)), orderBy('order', 'asc')),
    [firmId, clientId],
  );
  const requests = useCollection<DocRequest>(requestsQuery);

  const documentsRef = useMemo(
    () => collection(db, paths.documents(firmId, clientId)),
    [firmId, clientId],
  );
  const documents = useCollection<StoredDocument>(documentsRef);

  const taxYear = client.data?.taxYear ?? new Date().getUTCFullYear() - 1;
  const { items: uploadItems, start, cancel, retry, dismiss } = useUploads({
    firmId,
    clientId,
    taxYear,
  });

  const docsById = useMemo(
    () => new Map(documents.data.map((d) => [d.id, d])),
    [documents.data],
  );

  // Undo for a just-uploaded document. On success the live listener drops the
  // now-`retracted` doc from the list; we only have to clear the in-flight
  // upload row, which the listener doesn't own.
  const { retract: retractDoc, pending: retractPending, errors: retractErrors } = useRetract();
  const onUndo = useCallback(
    (documentId: string) => {
      retractDoc(documentId, () => {
        const item = uploadItems.find((u) => u.documentId === documentId);
        if (item) dismiss(item.id);
      });
    },
    [retractDoc, uploadItems, dismiss],
  );

  // Settled documents grouped by the type the classifier assigned.
  const docsByType = useMemo(() => {
    const map = new Map<string, StoredDocument[]>();
    for (const d of documents.data) {
      const type = d.classification?.docTypeId;
      if (!type || !SETTLED_DOC_STATES.has(d.state)) continue;
      const list = map.get(type);
      if (list) list.push(d);
      else map.set(type, [d]);
    }
    return map;
  }, [documents.data]);

  // Auto-clear a finished upload once its recognition has been on screen a beat;
  // the checklist row itself now carries the document.
  const scheduled = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const item of uploadItems) {
      if (item.status !== 'processing' || !item.documentId || scheduled.current.has(item.id)) continue;
      const doc = docsById.get(item.documentId);
      if (doc && SETTLED_DOC_STATES.has(doc.state)) {
        scheduled.current.add(item.id);
        window.setTimeout(() => {
          dismiss(item.id);
          scheduled.current.delete(item.id);
        }, 5000);
      }
    }
  }, [uploadItems, docsById, dismiss]);

  const applicable = requests.data.filter((r) => r.status !== 'waived');
  const total = applicable.length;
  const doneCount = applicable.filter(isComplete).length;
  const remaining = total - doneCount;
  const allDone = total > 0 && remaining === 0;

  const neededRows = applicable
    .filter((r) => !isComplete(r))
    .sort((a, b) => Number(a.status !== 'rejected') - Number(b.status !== 'rejected') || a.order - b.order);
  const doneRows = applicable.filter(isComplete).sort((a, b) => a.order - b.order);

  const requestedTypes = new Set(requests.data.map((r) => r.docTypeId));
  const extraDocs = documents.data.filter(
    (d) =>
      SETTLED_DOC_STATES.has(d.state) &&
      d.classification?.docTypeId &&
      !requestedTypes.has(d.classification.docTypeId),
  );
  const extraUploads = uploadItems.filter((u) => u.requestId === null);

  const firmName = firm.data?.branding.displayName ?? 'your accountant';
  const supportPhone = firm.data?.branding.supportPhone;

  const rowsForRequest = (r: DocRequest) => docsByType.get(r.docTypeId) ?? [];
  const uploadsForRequest = (r: DocRequest) => uploadItems.filter((u) => u.requestId === r.id);

  const loading = requests.loading && requests.data.length === 0;

  return (
    <div className="mx-auto min-h-dvh max-w-xl">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/85 backdrop-blur-sm">
        <div className="flex items-center gap-2 px-5 py-3">
          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded bg-stamp text-white">
            <ShieldCheck className="size-3.5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{firmName}</span>
          <span className="hidden items-center gap-1 text-2xs text-ink-faint sm:inline-flex">
            <ShieldCheck className="size-3" aria-hidden />
            Private
          </span>
          <LanguageMenu />
        </div>
      </header>

      <main className="px-5 pb-28 pt-7">
        {loading ? (
          <ListSkeleton />
        ) : requests.error ? (
          <EmptyState
            title="We couldn’t load your list"
            description="Check your connection and reload the page. Nothing you’ve sent is lost."
          />
        ) : (
          <>
            <section aria-labelledby="portal-heading">
              <h1 id="portal-heading" className="display text-balance text-4xl leading-[1.05] text-ink">
                {t('portal.title', { firmName })}
              </h1>
              <p className="mt-3 text-pretty text-sm/relaxed text-ink-muted">
                {t('portal.uploadHint')}
              </p>

              {total > 0 ? (
                <div className="mt-6 rounded-xl border border-line bg-surface p-4 shadow-xs">
                  <p className="text-sm font-medium text-ink">
                    {t('portal.progress', { receivedCount: doneCount, totalCount: total })}
                  </p>
                  <Progress
                    value={total > 0 ? (doneCount / total) * 100 : 0}
                    className="mt-3"
                    indicatorClassName={allDone ? 'bg-status-success' : undefined}
                  />
                </div>
              ) : null}
            </section>

            {allDone ? <DonePanel /> : null}

            {neededRows.length > 0 ? (
              <section className="mt-9" aria-labelledby="needed-heading">
                <h2 id="needed-heading" className="label-eyebrow mb-1">
                  {t('portal.needed')}
                </h2>
                <ul className="divide-y divide-line">
                  {neededRows.map((r) => (
                    <ChecklistItem
                      key={r.id}
                      request={r}
                      docs={rowsForRequest(r)}
                      uploads={uploadsForRequest(r)}
                      docsById={docsById}
                      coarse={coarse}
                      onFiles={(files, requestId) => start(files, requestId)}
                      onCancel={cancel}
                      onRetry={retry}
                      onDismiss={dismiss}
                      onUndo={onUndo}
                      retractPending={retractPending}
                      retractErrors={retractErrors}
                    />
                  ))}
                </ul>
              </section>
            ) : null}

            {doneRows.length > 0 ? (
              <section className="mt-9" aria-labelledby="done-heading">
                <h2 id="done-heading" className="label-eyebrow mb-1">
                  Done · {doneRows.length}
                </h2>
                <ul className="divide-y divide-line">
                  {doneRows.map((r) => (
                    <ChecklistItem
                      key={r.id}
                      request={r}
                      docs={rowsForRequest(r)}
                      uploads={uploadsForRequest(r)}
                      docsById={docsById}
                      coarse={coarse}
                      onFiles={(files, requestId) => start(files, requestId)}
                      onCancel={cancel}
                      onRetry={retry}
                      onDismiss={dismiss}
                      onUndo={onUndo}
                      retractPending={retractPending}
                      retractErrors={retractErrors}
                    />
                  ))}
                </ul>
              </section>
            ) : null}

            {total === 0 ? (
              <EmptyState
                className="mt-8"
                title="Nothing needed right now"
                description={`When ${firmName} needs a document from you, it will show up here.`}
              />
            ) : null}

            <section className="mt-9" aria-labelledby="extra-heading">
              <h2 id="extra-heading" className="label-eyebrow mb-2">
                Something else?
              </h2>
              <p className="mb-3 text-sm text-ink-muted">
                Have a document that isn’t on the list? Add it here and {firmName} will sort it out.
              </p>
              <div className="flex flex-col gap-2">
                {extraDocs
                  .filter((d) => !extraUploads.some((u) => u.documentId === d.id))
                  .map((d) => (
                    <DocLine
                      key={d.id}
                      doc={d}
                      onUndo={onUndo}
                      retracting={retractPending.has(d.id)}
                      error={retractErrors.get(d.id)}
                    />
                  ))}
                {extraUploads.map((u) => (
                  <UploadItemView
                    key={u.id}
                    item={u}
                    recognizedDoc={u.documentId ? docsById.get(u.documentId) : undefined}
                    onCancel={cancel}
                    onRetry={retry}
                    onDismiss={dismiss}
                    onUndo={onUndo}
                    retractPending={retractPending}
                    retractErrors={retractErrors}
                  />
                ))}
                <Uploader
                  coarse={coarse}
                  label={t('portal.upload')}
                  onFiles={(files) => start(files, null)}
                />
              </div>
            </section>

            <footer className="mt-12 border-t border-line pt-5">
              <p className="text-sm/relaxed text-ink-muted">{t('portal.help')}</p>
              {supportPhone ? (
                <a
                  href={`tel:${supportPhone}`}
                  className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-ink transition-colors hover:text-ink-muted"
                >
                  <Phone className="size-4 shrink-0" aria-hidden />
                  <span dir="ltr" className="tabular-nums">{formatUsPhone(supportPhone)}</span>
                </a>
              ) : null}
            </footer>
          </>
        )}
      </main>
    </div>
  );
}

function DonePanel() {
  const { t } = usePortalLocale();
  return (
    <EmptyState
      className="mt-8 border-transparent"
      vignette={<SealVignette className="w-36 sm:w-40" />}
      title={t('portal.allDone')}
    />
  );
}

function ListSkeleton() {
  return (
    <div>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-9 w-64" />
      <Skeleton className="mt-3 h-4 w-full max-w-sm" />
      <Skeleton className="mt-6 h-20 w-full rounded-xl" />
      <div className="mt-9 space-y-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-5 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-3 w-full max-w-xs" />
              <Skeleton className="mt-3 h-10 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
