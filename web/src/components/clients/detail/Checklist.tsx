import { useMemo, type ReactNode } from 'react';
import {
  Check,
  MoreHorizontal,
  Package,
  Sparkles,
  X,
} from 'lucide-react';
import {
  docType,
  type DocRequest,
  type RequestPriority,
  type RequestStatus,
  type StoredDocument,
} from '@taxfax/shared';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { RequestStatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { PriorityDot, RelTime } from '../bits';
import { deleteRequest, run, setRequestStatus } from '../actions';

type Req = DocRequest & { id: string };
type Doc = StoredDocument & { id: string };

const PRIORITY_RANK: Record<RequestPriority, number> = { critical: 0, standard: 1, optional: 2 };

interface ChecklistProps {
  firmId: string;
  clientId: string;
  requests: Req[];
  documents: Doc[];
}

export function Checklist({ firmId, clientId, requests, documents }: ChecklistProps) {
  const docsByRequest = useMemo(() => {
    const m = new Map<string, Doc[]>();
    for (const d of documents) {
      if (!d.requestId) continue;
      const list = m.get(d.requestId) ?? [];
      list.push(d);
      m.set(d.requestId, list);
    }
    return m;
  }, [documents]);

  const sections = useMemo(() => {
    const bucket = (r: Req) =>
      r.status === 'received' ? 'review' : r.status === 'accepted' || r.status === 'waived' ? 'done' : 'outstanding';
    const by = { outstanding: [] as Req[], review: [] as Req[], done: [] as Req[] };
    for (const r of requests) by[bucket(r)].push(r);
    const sort = (a: Req, b: Req) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.order - b.order;
    by.outstanding.sort(sort);
    by.review.sort(sort);
    by.done.sort(sort);
    return by;
  }, [requests]);

  if (requests.length === 0)
    return (
      <EmptyState
        icon={Package}
        title="No checklist yet"
        description="Add the documents you need from this client, or import last year’s return to build it automatically."
        className="mt-1"
      />
    );

  return (
    <div className="space-y-5">
      <Section title="Outstanding" count={sections.outstanding.length} tone="warn">
        {sections.outstanding.map((r) => (
          <RequestRow key={r.id} req={r} docs={docsByRequest.get(r.id) ?? []} firmId={firmId} clientId={clientId} />
        ))}
      </Section>
      <Section title="In review" count={sections.review.length} tone="info">
        {sections.review.map((r) => (
          <RequestRow key={r.id} req={r} docs={docsByRequest.get(r.id) ?? []} firmId={firmId} clientId={clientId} />
        ))}
      </Section>
      <Section title="Settled" count={sections.done.length} tone="success">
        {sections.done.map((r) => (
          <RequestRow key={r.id} req={r} docs={docsByRequest.get(r.id) ?? []} firmId={firmId} clientId={clientId} />
        ))}
      </Section>
    </div>
  );
}

const TONE_DOT: Record<'warn' | 'info' | 'success', string> = {
  warn: 'bg-status-warn',
  info: 'bg-status-info',
  success: 'bg-status-success',
};

function Section({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone: 'warn' | 'info' | 'success';
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className={cn('size-1.5 rounded-full', TONE_DOT[tone])} aria-hidden />
        <h3 className="text-2xs font-semibold uppercase tracking-wide text-ink-muted">{title}</h3>
        <span className="tabular-nums text-2xs text-ink-faint">{count}</span>
      </div>
      <ul className="divide-y divide-line rounded-xl border border-line">{children}</ul>
    </section>
  );
}

function RequestRow({
  req,
  docs,
  firmId,
  clientId,
}: {
  req: Req;
  docs: Doc[];
  firmId: string;
  clientId: string;
}) {
  const def = docType(req.docTypeId);
  const label = req.label ?? def.label;
  const settled = req.status === 'accepted' || req.status === 'waived';

  const set = (status: RequestStatus, msg: string) =>
    void run(setRequestStatus(firmId, clientId, req.id, status), { success: msg });

  return (
    <li className={cn('group px-4 py-3', settled && 'opacity-80')}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="shrink-0 font-medium">
              {def.code}
            </Badge>
            <span className="truncate text-sm font-medium text-ink">{label}</span>
            {req.expectedCount > 1 ? (
              <span className="shrink-0 tabular-nums text-2xs text-ink-faint">×{req.expectedCount}</span>
            ) : null}
            <PriorityDot priority={req.priority} />
          </div>

          {/* The differentiator: why this document is on the list at all. */}
          {req.reason ? (
            <p className="mt-1.5 flex items-start gap-1.5 text-2xs/relaxed text-ink-muted">
              <Sparkles className="mt-px size-3 shrink-0 text-stamp" aria-hidden />
              <span>{req.reason}</span>
            </p>
          ) : null}

          {req.expectedIssuers?.length ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="text-2xs text-ink-faint">Expected from</span>
              {req.expectedIssuers.map((iss) => (
                <Badge key={iss} variant="neutral">
                  {iss}
                </Badge>
              ))}
            </div>
          ) : null}

          {docs.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {docs.map((d) => (
                <span key={d.id} className="ticket truncate rounded bg-surface-sunken px-1.5 py-0.5 text-2xs text-ink-muted">
                  {d.canonicalName ?? d.originalName}
                </span>
              ))}
            </div>
          ) : null}

          {req.status === 'rejected' && req.rejectionReason ? (
            <p className="mt-1.5 text-2xs text-status-danger">Sent back: {req.rejectionReason}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <RequestStatusPill status={req.status} />
          {req.dueDate ? (
            <span className="text-2xs text-ink-faint">
              due <RelTime at={req.dueDate} className="text-ink-faint" />
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-end gap-1.5">
        <RowActions req={req} onSet={set} firmId={firmId} clientId={clientId} />
      </div>
    </li>
  );
}

function RowActions({
  req,
  onSet,
  firmId,
  clientId,
}: {
  req: Req;
  onSet: (status: RequestStatus, msg: string) => void;
  firmId: string;
  clientId: string;
}) {
  const def = docType(req.docTypeId);
  return (
    <>
      {(req.status === 'pending' || req.status === 'rejected') && (
        <Button size="sm" variant="secondary" onClick={() => onSet('received', `Marked ${def.code} received`)}>
          <Check className="size-3.5" />
          Mark received
        </Button>
      )}
      {req.status === 'received' && (
        <>
          <Button size="sm" variant="secondary" onClick={() => onSet('rejected', `${def.code} sent back to the client`)}>
            <X className="size-3.5" />
            Send back
          </Button>
          <Button size="sm" variant="primary" onClick={() => onSet('accepted', `Accepted ${def.code}`)}>
            <Check className="size-3.5" />
            Accept
          </Button>
        </>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" iconOnly aria-label="More actions">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {req.status !== 'accepted' && (
            <DropdownMenuItem onSelect={() => onSet('accepted', `Accepted ${def.code}`)}>
              <Check className="size-4" />
              Mark accepted
            </DropdownMenuItem>
          )}
          {req.status !== 'waived' && (
            <DropdownMenuItem onSelect={() => onSet('waived', `Waived ${def.code} — not needed this year`)}>
              Waive — not needed
            </DropdownMenuItem>
          )}
          {req.status !== 'pending' && (
            <DropdownMenuItem onSelect={() => onSet('pending', `Reopened ${def.code}`)}>
              Reopen as needed
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="danger"
            onSelect={() =>
              void run(deleteRequest(firmId, clientId, req.id), { success: `Removed ${def.code} from the checklist` })
            }
          >
            Remove request
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
