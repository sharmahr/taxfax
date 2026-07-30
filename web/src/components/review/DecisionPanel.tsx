import { useState } from 'react';
import { ArrowUpRight, Check, RotateCcw, X } from 'lucide-react';
import { canonicalName, docType, type Classification } from '@taxfax/shared';
import { Button, Kbd, Textarea } from '@/components/ui';
import { cn } from '@/lib/cn';
import { firstName } from '@/lib/format';
import { ReclassifyPicker } from './ReclassifyPicker';
import type { QueueItem } from './useReviewQueue';

export type ReviewMode = 'idle' | 'reject' | 'reclassify';

const METHOD_LABEL: Record<Classification['method'], string> = {
  text: 'Read the document text',
  ocr: 'Read the scan with OCR',
  filename: 'Matched the filename',
  manual: 'Set by a preparer',
};

const REJECT_PRESETS = ['Illegible or blurry', 'Wrong tax year', 'Only part of the document', 'Wrong client', 'Duplicate'];

interface DecisionPanelProps {
  item: QueueItem;
  mode: ReviewMode;
  setMode: (m: ReviewMode) => void;
  onAccept: () => void;
  onReject: (reason: string) => void;
  onReclassify: (docTypeId: string, code: string, issuer?: string) => void;
}

export function DecisionPanel({ item, mode, setMode, onAccept, onReject, onReclassify }: DecisionPanelProps) {
  const cls = item.classification;
  const def = docType(cls?.docTypeId ?? 'other');
  const confidence = cls?.confidence ?? 0;
  const canonical = canonicalName({
    clientDisplayName: item.clientName,
    taxYear: item.taxYear,
    docTypeId: def.id,
    issuer: cls?.issuer,
    originalName: item.originalName,
    contentType: item.contentType,
  });
  const needsReview = item.state === 'needs_review';

  if (mode === 'reclassify') {
    return (
      <PanelFrame item={item}>
        <div className="min-h-0 flex-1">
          <ReclassifyPicker
            currentDocTypeId={def.id}
            onCancel={() => setMode('idle')}
            onPick={(docTypeId, code) => onReclassify(docTypeId, code, cls?.issuer)}
          />
        </div>
      </PanelFrame>
    );
  }

  return (
    <PanelFrame item={item}>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h2 className="ticket text-lg font-medium text-ink">{def.code}</h2>
              {cls?.issuer && <span className="truncate text-sm text-ink-muted">· {cls.issuer}</span>}
            </div>
            <p className="mt-0.5 text-sm text-ink-muted">{def.label}</p>
          </div>
          <ConfidenceBadge value={confidence} needsReview={needsReview} />
        </div>

        <ConfidenceMeter value={confidence} />

        <Field label={`Why the classifier said ${def.code}`}>
          {cls && cls.evidence.length > 0 ? (
            <ul className="space-y-1.5">
              {cls.evidence.map((e, i) => (
                <li key={i} className="flex gap-2 text-[13px] text-ink">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-ink-faint" aria-hidden />
                  <span className="text-pretty">{e}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-ink-muted">
              No strong signal in the file — that's why it's here for a human.
            </p>
          )}
          {cls && (
            <p className="mt-2 text-2xs text-ink-faint">
              {METHOD_LABEL[cls.method]} · {Math.round(confidence * 100)}% confident
            </p>
          )}
        </Field>

        <Field label="Will be filed as">
          <p className="ticket break-all rounded-md border border-line bg-surface-sunken px-2.5 py-2 text-ink">
            {canonical}
          </p>
        </Field>

        {cls && cls.alternates.length > 0 && (
          <Field label={`Not ${def.code}? One tap to correct`}>
            <div className="space-y-1">
              {cls.alternates.slice(0, 8).map((alt, i) => (
                <AlternateRow
                  key={alt.docTypeId}
                  index={i + 1}
                  alt={alt}
                  onPick={() => {
                    const d = docType(alt.docTypeId);
                    onReclassify(d.id, d.code, cls.issuer);
                  }}
                />
              ))}
              <button
                type="button"
                onClick={() => setMode('reclassify')}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] text-ink-muted transition-colors hover:bg-surface-sunken/60"
              >
                <Kbd>C</Kbd>
                <span>Something else…</span>
              </button>
            </div>
          </Field>
        )}

        <div className="pt-1">
          <a
            href={`/clients/${item.clientId}`}
            className="inline-flex items-center gap-1 text-2xs text-ink-faint transition-colors hover:text-ink"
          >
            Open {item.clientName}'s file <ArrowUpRight className="size-3" />
          </a>
        </div>
      </div>

      {mode === 'reject' ? (
        <RejectForm client={item.clientName} onCancel={() => setMode('idle')} onSubmit={onReject} />
      ) : (
        <div className="flex items-center gap-2 border-t border-line px-5 py-3">
          <Button variant="danger" onClick={() => setMode('reject')} className="shrink-0">
            <X /> Reject <Kbd className="ml-1 border-paper/25 bg-paper/15 text-paper">R</Kbd>
          </Button>
          <Button variant="secondary" onClick={() => setMode('reclassify')} className="shrink-0">
            <RotateCcw /> Reclassify <Kbd className="ml-1">C</Kbd>
          </Button>
          <Button variant="primary" onClick={onAccept} className="ml-auto flex-1 sm:flex-initial">
            <Check /> Accept <Kbd className="ml-1 border-paper/25 bg-paper/15 text-paper">A</Kbd>
          </Button>
        </div>
      )}
    </PanelFrame>
  );
}

function PanelFrame({ item, children }: { item: QueueItem; children: React.ReactNode }) {
  return (
    <section aria-label="Classification decision" className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{item.clientName}</p>
          <p className="text-2xs text-ink-faint">Uploaded {item.uploadedVia === 'portal' ? 'from the portal' : `by ${item.uploadedVia}`}</p>
        </div>
        <StateTag needsReview={item.state === 'needs_review'} />
      </header>
      {children}
    </section>
  );
}

function StateTag({ needsReview }: { needsReview: boolean }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-lg border px-2 py-0.5 text-2xs font-medium',
        needsReview
          ? 'border-status-warn/25 bg-status-warn-wash text-status-warn'
          : 'border-status-info/25 bg-status-info-wash text-status-info',
      )}
    >
      {needsReview ? 'Needs a decision' : 'Spot-check'}
    </span>
  );
}

function ConfidenceBadge({ value, needsReview }: { value: number; needsReview: boolean }) {
  const pct = Math.round(value * 100);
  return (
    <div className="shrink-0 text-right">
      <p className={cn('font-mono text-lg tabular-nums', needsReview ? 'text-status-warn' : 'text-ink')}>{pct}%</p>
      <p className="text-2xs text-ink-faint">confident</p>
    </div>
  );
}

function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const tone = value >= 0.82 ? 'bg-status-success' : value >= 0.45 ? 'bg-status-warn' : 'bg-status-danger';
  return (
    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken" role="img" aria-label={`${pct}% confident`}>
      <div className={cn('h-full rounded-full transition-[width] duration-500 ease-out-quint', tone)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="label-eyebrow mb-2 text-ink-faint">{label}</h3>
      {children}
    </div>
  );
}

function AlternateRow({ index, alt, onPick }: { index: number; alt: Classification['alternates'][number]; onPick: () => void }) {
  const d = docType(alt.docTypeId);
  return (
    <button
      type="button"
      onClick={onPick}
      className="group/alt flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-sunken/60"
    >
      <Kbd>{index}</Kbd>
      <span className="ticket shrink-0 text-ink">{d.code}</span>
      <span className="truncate text-[13px] text-ink-muted">{d.label}</span>
      <span className="ml-auto shrink-0 font-mono text-2xs tabular-nums text-ink-faint">{Math.round(alt.confidence * 100)}%</span>
    </button>
  );
}

function RejectForm({
  client,
  onSubmit,
  onCancel,
}: {
  client: string;
  onSubmit: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();

  function submit() {
    if (trimmed) onSubmit(trimmed);
  }

  return (
    <div className="border-t border-line bg-surface-sunken/40 px-5 py-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-2xs font-medium text-ink">
          What should {firstName(client)} fix? <span className="text-ink-faint">They'll see this.</span>
        </p>
        <button onClick={onCancel} className="text-2xs text-ink-faint hover:text-ink" aria-label="Cancel rejection">
          Cancel
        </button>
      </div>
      <Textarea
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        rows={2}
        placeholder="e.g. This is last year's 1099 — we need the 2025 one."
        className="resize-none text-sm"
      />
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {REJECT_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setReason(p)}
            className="rounded-md border border-line bg-surface px-2 py-1 text-2xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink"
          >
            {p}
          </button>
        ))}
        <Button size="sm" variant="danger" onClick={submit} disabled={!trimmed} className="ml-auto">
          Send back <Kbd className="ml-1 border-paper/25 bg-paper/15 text-paper">↵</Kbd>
        </Button>
      </div>
    </div>
  );
}
