import type { ReactNode } from 'react';
import {
  Check,
  CircleCheck,
  CircleDashed,
  FileText,
  RotateCcw,
  TriangleAlert,
  X,
} from 'lucide-react';
import {
  docType,
  docCodeLabel,
  formatList,
  type DocRequest,
  type RequestStatus,
  type StoredDocument,
} from '@taxfax/shared';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill';
import { Uploader, UploadLine } from './Uploader';
import { usePortalLocale } from './locale';
import type { UploadItem } from './useUploads';

/** States we treat as "the taxpayer has done their part". */
const SETTLED_DOC_STATES = new Set(['classified', 'needs_review', 'accepted']);

/** The retraction grace window mirrors functions/src/firm/portal.ts. */
const RETRACT_WINDOW_MS = 24 * 60 * 60 * 1000;

function toMillis(ts: unknown): number {
  if (ts instanceof Date) return ts.getTime();
  if (ts && typeof ts === 'object') {
    const o = ts as { toMillis?: () => number; seconds?: number };
    if (typeof o.toMillis === 'function') return o.toMillis();
    if (typeof o.seconds === 'number') return o.seconds * 1000;
  }
  // A pending serverTimestamp reads as null on the writer for a beat — it was
  // just uploaded, so it is unambiguously inside the window.
  return Date.now();
}

/**
 * Whether to offer the taxpayer an undo for a recognized document. Deliberately
 * narrower than the server's rule: only a settled document they uploaded, that
 * a preparer hasn't accepted, inside the grace window. The server is still the
 * source of truth and enforces the same bounds — this only avoids dangling a
 * button that would just be refused.
 */
export function canRetract(doc: StoredDocument): boolean {
  if (doc.uploadedVia !== 'portal') return false;
  if (doc.state !== 'classified' && doc.state !== 'needs_review') return false;
  return Date.now() - toMillis(doc.uploadedAt) <= RETRACT_WINDOW_MS;
}

interface UndoProps {
  onUndo?: (documentId: string) => void;
  retractPending?: ReadonlySet<string>;
  retractErrors?: ReadonlyMap<string, string>;
}

/**
 * Undo, never a red destructive action. Correcting a wrong photo must feel as
 * light as taking it — treat it as dangerous and the taxpayer phones the firm,
 * which is the friction this whole product removes.
 */
function UndoButton({ busy, label, onClick }: { busy: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={busy ? `Removing ${label}` : `Undo — remove ${label}`}
      className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink disabled:opacity-60"
    >
      <RotateCcw className="size-3" aria-hidden />
      {busy ? 'Removing…' : 'Undo'}
    </button>
  );
}

/** Pill tone per checklist status, mirroring the ui/ enum wrapper. */
const REQUEST_TONE: Record<RequestStatus, StatusTone> = {
  pending: 'neutral',
  received: 'info',
  accepted: 'success',
  rejected: 'danger',
  waived: 'neutral',
};

function recognizedText(doc: StoredDocument): string {
  const id = doc.classification?.docTypeId ?? 'other';
  if (id === 'other') return 'Got it — saved to your file.';
  const code = docType(id).code;
  const issuer = doc.classification?.issuer;
  return issuer ? `Got it — ${code} from ${issuer}.` : `Got it — ${code}.`;
}

/**
 * The language-independent identity of the recognition line. The swap animation
 * must replay when the sentence changes *meaning* — a pending upload resolving
 * into `W-2 from Acme` — but never when only the *language* changes. Keying the
 * swap on the rendered text would re-stamp every recognized note the instant a
 * taxpayer switched language: a screenful of motion fired at the very users the
 * switcher exists to help. The classifier's type id can't do that. `other` and
 * the pre-classification stub both render the same "saved" sentence, so they
 * share one key and never animate between each other.
 */
function recognizedKey(doc: StoredDocument | undefined): string {
  const id = doc?.classification?.docTypeId;
  return id && id !== 'other' ? id : 'pending';
}

/** A quietly-confirmed document already on file for this row. */
export function DocLine({
  doc,
  onUndo,
  retracting,
  error,
}: {
  doc: StoredDocument;
  onUndo?: (documentId: string) => void;
  retracting?: boolean;
  error?: string;
}) {
  const undoable = onUndo != null && canRetract(doc);
  return (
    <UploadLine tone="success" icon={<Check className="size-4 text-status-success" aria-hidden />}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{recognizedText(doc)}</p>
          <p className="ticket mt-0.5 truncate text-ink-faint">{doc.originalName}</p>
        </div>
        {undoable ? (
          <UndoButton busy={!!retracting} label={doc.originalName} onClick={() => onUndo!(doc.id)} />
        ) : null}
      </div>
      {error ? (
        <p className="mt-1 text-2xs text-status-danger" role="alert">
          {error}
        </p>
      ) : null}
    </UploadLine>
  );
}

/**
 * The single authored motion moment in the product.
 *
 * Two things happen here and both are questions the taxpayer is actively
 * asking. "Did my photo make it?" is answered by a stamp landing the instant
 * the bytes are durable. "What did you do with it?" is answered seconds later,
 * when the same line stops saying `saved to your file` and starts saying
 * `W-2 from Acme Corp` — keyed on the title, so the upgrade replays the swap
 * rather than silently substituting one sentence for another.
 */
function RecognizedNote({
  swapKey,
  title,
  subtitle,
  action,
  error,
}: {
  /**
   * Language-independent identity of the sentence. Replays the swap when the
   * document's *meaning* resolves, never when only its *language* changes.
   */
  swapKey: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
  error?: string;
}) {
  return (
    <UploadLine
      tone="success"
      icon={
        <span
          className="stamp-in grid size-5 place-items-center rounded-full bg-status-success text-white"
          aria-hidden
        >
          <Check className="size-3.5" strokeWidth={3} />
        </span>
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p key={swapKey} className="swap-in text-sm font-medium text-ink" role="status">
            {title}
          </p>
          <p className="ticket mt-0.5 truncate text-ink-faint">{subtitle}</p>
        </div>
        {action ?? null}
      </div>
      {error ? (
        <p className="mt-1 text-2xs text-status-danger" role="alert">
          {error}
        </p>
      ) : null}
    </UploadLine>
  );
}

interface UploadItemViewProps extends UndoProps {
  item: UploadItem;
  recognizedDoc: StoredDocument | undefined;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onDismiss: (id: string) => void;
}

export function UploadItemView({
  item,
  recognizedDoc,
  onCancel,
  onRetry,
  onDismiss,
  onUndo,
  retractPending,
  retractErrors,
}: UploadItemViewProps) {
  if (item.status === 'error') {
    return (
      <UploadLine tone="danger" icon={<TriangleAlert className="size-4 text-status-danger" aria-hidden />}>
        <p className="text-sm font-medium text-ink" role="alert">
          {item.error ?? 'That upload didn’t go through.'}
        </p>
        <p className="ticket mt-0.5 truncate text-ink-faint">{item.displayName}</p>
        <div className="mt-2 flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => onRetry(item.id)}>
            <RotateCcw className="size-3.5" aria-hidden />
            Try again
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onDismiss(item.id)}>
            Remove
          </Button>
        </div>
      </UploadLine>
    );
  }

  if (item.status === 'processing') {
    if (recognizedDoc && recognizedDoc.state === 'failed') {
      return (
        <UploadLine tone="danger" icon={<TriangleAlert className="size-4 text-status-danger" aria-hidden />}>
          <p className="text-sm font-medium text-ink" role="alert">
            {recognizedDoc.error ?? 'We couldn’t read that one. Try a clearer photo.'}
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => onRetry(item.id)}>
              <RotateCcw className="size-3.5" aria-hidden />
              Try again
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onDismiss(item.id)}>
              Remove
            </Button>
          </div>
        </UploadLine>
      );
    }
    if (recognizedDoc && SETTLED_DOC_STATES.has(recognizedDoc.state)) {
      const undoable = onUndo != null && canRetract(recognizedDoc);
      return (
        <RecognizedNote
          swapKey={recognizedKey(recognizedDoc)}
          title={recognizedText(recognizedDoc)}
          subtitle={recognizedDoc.originalName}
          action={
            undoable ? (
              <UndoButton
                busy={retractPending?.has(recognizedDoc.id) ?? false}
                label={recognizedDoc.originalName}
                onClick={() => onUndo!(recognizedDoc.id)}
              />
            ) : undefined
          }
          error={retractErrors?.get(recognizedDoc.id)}
        />
      );
    }
    // The bytes are durably saved the moment we reach `processing`. Confirm right
    // away rather than making the taxpayer wait on classification — this note
    // upgrades to the recognized type above as soon as the pipeline reports back.
    return <RecognizedNote swapKey="pending" title="Got it — saved to your file." subtitle={item.displayName} />;
  }

  // preparing | uploading
  const pct = Math.round(item.progress * 100);
  return (
    <UploadLine icon={<FileText className="size-4 text-ink-faint" aria-hidden />}>
      <div className="flex items-center justify-between gap-3">
        <p className="ticket min-w-0 truncate text-ink">{item.displayName}</p>
        <button
          type="button"
          onClick={() => onCancel(item.id)}
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <X className="size-3" aria-hidden />
          Cancel
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Progress value={item.status === 'preparing' ? 6 : pct} className="flex-1" />
        <span className="ticket w-16 shrink-0 text-end text-2xs text-ink-faint">
          {item.status === 'preparing' ? 'Preparing' : `${pct}%`}
        </span>
      </div>
    </UploadLine>
  );
}

export interface ChecklistItemProps extends UndoProps {
  request: DocRequest;
  /** Documents already recognized for this request. */
  docs: StoredDocument[];
  /** In-flight uploads the taxpayer started for this row. */
  uploads: UploadItem[];
  /** Look up the finalized document for a processing upload. */
  docsById: Map<string, StoredDocument>;
  coarse: boolean;
  onFiles: (files: File[], requestId: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onDismiss: (id: string) => void;
}

export function ChecklistItem({
  request,
  docs,
  uploads,
  docsById,
  coarse,
  onFiles,
  onCancel,
  onRetry,
  onDismiss,
  onUndo,
  retractPending,
  retractErrors,
}: ChecklistItemProps) {
  const { t, locale } = usePortalLocale();

  const accepted = request.status === 'accepted';
  const rejected = request.status === 'rejected';
  const provided = Math.max(docs.length, request.documentIds.length);
  const needsMore = !accepted && provided < request.expectedCount;
  const showUploader = request.status === 'pending' || rejected || needsMore;

  const StatusIcon = accepted ? CircleCheck : rejected ? TriangleAlert : provided > 0 ? Check : CircleDashed;
  const iconTone = accepted
    ? 'text-status-success'
    : rejected
      ? 'text-status-danger'
      : provided > 0
        ? 'text-status-info'
        : 'text-ink-faint';

  // Short doc label in the taxpayer's language ("W-2", "1099-INT"), with the
  // firm's own request label as the fallback. Issuers are joined with a locale
  // list format and isolated for bidi by `t()` itself.
  const baseLabel = docCodeLabel(locale, request.docTypeId, request.label ?? docType(request.docTypeId).code);
  const expectedIssuers = request.expectedIssuers ?? [];
  const title =
    expectedIssuers.length > 0
      ? t('item.fromIssuer', { code: baseLabel, issuers: formatList(locale, expectedIssuers) })
      : baseLabel;

  return (
    <li className="flex flex-col gap-3 py-5 first:pt-0">
      <div className="flex items-start gap-3">
        <StatusIcon className={cn('mt-0.5 size-[1.125rem] shrink-0', iconTone)} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-[0.9375rem] font-semibold leading-tight text-ink">{title}</h3>
            <StatusPill tone={REQUEST_TONE[request.status]}>{t(`status.${request.status}`)}</StatusPill>
          </div>
          {request.reason ? (
            <p className="mt-1 text-pretty text-sm leading-relaxed text-ink-muted">
              <span className="sr-only">{t('portal.whyAsked')}: </span>
              {request.reason}
            </p>
          ) : null}
          {rejected && request.rejectionReason ? (
            <p className="mt-1.5 text-sm text-status-danger">
              Needs another try: {request.rejectionReason}
            </p>
          ) : null}
          {request.instructions ? (
            <p className="mt-1 text-sm text-ink-muted">{request.instructions}</p>
          ) : null}
          {request.expectedCount > 1 && provided > 0 ? (
            <p className="ticket mt-1.5 text-2xs text-ink-faint">
              {provided} of {request.expectedCount} uploaded
            </p>
          ) : null}
        </div>
      </div>

      {(uploads.length > 0 || docs.length > 0 || showUploader) && (
        <div className="flex flex-col gap-2 ps-[1.875rem]">
          {docs
            .filter((d) => !uploads.some((u) => u.documentId === d.id))
            .map((d) => (
              <DocLine
                key={d.id}
                doc={d}
                onUndo={onUndo}
                retracting={retractPending?.has(d.id)}
                error={retractErrors?.get(d.id)}
              />
            ))}

          {uploads.map((u) => (
            <UploadItemView
              key={u.id}
              item={u}
              recognizedDoc={u.documentId ? docsById.get(u.documentId) : undefined}
              onCancel={onCancel}
              onRetry={onRetry}
              onDismiss={onDismiss}
              onUndo={onUndo}
              retractPending={retractPending}
              retractErrors={retractErrors}
            />
          ))}

          {showUploader ? (
            <Uploader
              coarse={coarse}
              label={title}
              onFiles={(files) => onFiles(files, request.id)}
            />
          ) : null}
        </div>
      )}
    </li>
  );
}
