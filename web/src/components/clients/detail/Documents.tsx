import { useState } from 'react';
import { FileText, Sparkles } from 'lucide-react';
import {
  docType,
  type Classification,
  type DocumentState,
  type StoredDocument,
} from '@taxfax/shared';
import { cn } from '@/lib/cn';
import { percent, toDate } from '@/lib/format';
import { Badge } from '@/components/ui/Badge';
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { EmptyState } from '@/components/ui/EmptyState';
import { RelTime } from '../bits';

type Doc = StoredDocument & { id: string };

const STATE_META: Record<DocumentState, { label: string; tone: StatusTone }> = {
  uploading: { label: 'Uploading', tone: 'neutral' },
  scanning: { label: 'Reading', tone: 'info' },
  classified: { label: 'Classified', tone: 'info' },
  needs_review: { label: 'Check type', tone: 'warn' },
  accepted: { label: 'Accepted', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  retracted: { label: 'Withdrawn', tone: 'neutral' },
  failed: { label: 'Failed', tone: 'danger' },
};

const METHOD_LABEL: Record<Classification['method'], string> = {
  text: 'read from the PDF text',
  ocr: 'read by OCR',
  filename: 'inferred from the filename',
  manual: 'set by hand',
};

function formatBytes(bytes: number): string {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB'];
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u++;
  }
  return `${n < 10 && u > 0 ? n.toFixed(1) : Math.round(n)} ${units[u]}`;
}

export function Documents({ documents }: { documents: Doc[] }) {
  if (documents.length === 0)
    return (
      <EmptyState
        icon={FileText}
        title="Nothing uploaded yet"
        description="As documents come in, each one is auto-classified and renamed to your firm’s convention — no filing required."
        className="mt-1"
      />
    );

  const sorted = [...documents].sort(
    (a, b) => toDate(b.uploadedAt).getTime() - toDate(a.uploadedAt).getTime(),
  );

  return (
    <ul className="divide-y divide-line rounded-xl border border-line">
      {sorted.map((doc) => (
        <DocumentRow key={doc.id} doc={doc} />
      ))}
    </ul>
  );
}

function DocumentRow({ doc }: { doc: Doc }) {
  const cls = doc.classification;
  const def = cls ? docType(cls.docTypeId) : null;
  const state = STATE_META[doc.state];
  const size = formatBytes(doc.sizeBytes);

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-surface-sunken text-ink-faint">
        <FileText className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="ticket truncate text-sm text-ink" title={doc.canonicalName ?? doc.originalName}>
            {doc.canonicalName ?? doc.originalName}
          </span>
          <StatusPill tone={state.tone} className="shrink-0">
            {state.label}
          </StatusPill>
        </div>

        {doc.canonicalName && doc.canonicalName !== doc.originalName ? (
          <p className="mt-0.5 truncate text-2xs text-ink-faint">
            renamed from <span className="ticket">{doc.originalName}</span>
          </p>
        ) : null}

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-ink-muted">
          {def ? (
            <span className="inline-flex items-center gap-1.5">
              <Badge variant="outline" className="font-medium">
                {def.code}
              </Badge>
              <span className="text-ink-muted">{def.label}</span>
            </span>
          ) : null}
          {cls?.issuer ? (
            <>
              <Dot />
              <span>{cls.issuer}</span>
            </>
          ) : null}
          {cls ? (
            <>
              <Dot />
              <ClassificationPopover cls={cls} />
            </>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 text-right text-2xs text-ink-faint">
        <RelTime at={doc.uploadedAt} />
        {size ? <div className="mt-0.5 tabular-nums">{size}</div> : null}
      </div>
    </li>
  );
}

function Dot() {
  return <span className="text-ink-faint/60">·</span>;
}

/** Shows why the classifier chose this type — the evidence, so preparers trust it. */
function ClassificationPopover({ cls }: { cls: Classification }) {
  const [open, setOpen] = useState(false);
  const conf = Math.round(cls.confidence * 100);
  const tone = conf >= 85 ? 'text-status-success' : conf >= 60 ? 'text-status-warn' : 'text-status-danger';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded text-ink-muted underline decoration-dotted underline-offset-2 transition-colors hover:text-ink"
        >
          <Sparkles className="size-3" />
          <span className={cn('tabular-nums font-medium', tone)}>{conf}%</span>
          <span>sure</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3 text-left">
        <p className="label-eyebrow">Why this type</p>
        <p className="mt-1 text-2xs text-ink-muted">
          {percent(cls.confidence)} confident · {METHOD_LABEL[cls.method]}
        </p>
        {cls.evidence.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {cls.evidence.slice(0, 4).map((e, i) => (
              <li key={i} className="flex gap-1.5 text-2xs text-ink">
                <span className="text-status-success">✓</span>
                <span className="ticket text-ink-muted">“{e}”</span>
              </li>
            ))}
          </ul>
        ) : null}
        {cls.alternates.length > 0 ? (
          <p className="mt-2 border-t border-line pt-2 text-2xs text-ink-faint">
            Also considered {docType(cls.alternates[0].docTypeId).code}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
