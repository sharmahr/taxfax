import { useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, Mail, MessageSquareText, Send } from 'lucide-react';
import type { ChaseTone } from '@taxfax/shared';
import { cn } from '@/lib/cn';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import {
  chaseErrorMessage,
  previewChase,
  sendChaseNow,
  type ChasePreview,
  type ChaseSendResult,
} from './chase';

export interface ChaseSendTarget {
  id: string;
  displayName: string;
}

interface ChaseSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  firmId: string;
  clients: ChaseSendTarget[];
  onSent?: () => void;
}

const TONE_LABEL: Record<ChaseTone, string> = {
  warm: 'Warm',
  neutral: 'Neutral',
  firm: 'Firm',
  urgent: 'Urgent',
  final: 'Final notice',
};

/**
 * The chase, made legible. Before a single reminder leaves the building a
 * partner reads the exact email + SMS, sees who it reaches (and who it can't),
 * then commits to a real send/`sendChaseNow` — no automated system touches a
 * client behind their back. One dialog drives both the single detail action and
 * the roster's bulk selection; bulk previews one client and fans the send out.
 */
export function ChaseSendDialog({ open, onOpenChange, firmId, clients, onSent }: ChaseSendDialogProps) {
  const bulk = clients.length > 1;
  const lead = clients[0] as ChaseSendTarget | undefined;

  const [preview, setPreview] = useState<ChasePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open || !lead) return;
    let live = true;
    setPreview(null);
    setError(null);
    setSending(false);
    setLoading(true);
    previewChase({ firmId, clientId: lead.id })
      .then((p) => live && setPreview(p))
      .catch((err) => live && setError(chaseErrorMessage(err)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [open, firmId, lead?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const rec = preview?.recipients;
  const canEmail = !!rec && rec.emails.length > 0 && !rec.emailSuppressed;
  const canSms = !!rec && rec.phones.length > 0 && !rec.smsSuppressed;
  const unreachable = !!preview && !canEmail && !canSms;
  const blocked = !bulk && unreachable;

  async function handleSend() {
    if (!lead) return;
    setSending(true);
    setError(null);
    try {
      if (!bulk) {
        const res = await sendChaseNow({ firmId, clientId: lead.id, force: true });
        if (!reportSingle(res, lead.displayName)) {
          setSending(false);
          return; // keep the dialog open so they see why nothing went out
        }
      } else {
        const settled = await Promise.allSettled(
          clients.map((c) => sendChaseNow({ firmId, clientId: c.id, force: true })),
        );
        reportBulk(settled);
      }
      onSent?.();
      onOpenChange(false);
    } catch (err) {
      setError(chaseErrorMessage(err));
    } finally {
      setSending(false);
    }
  }

  /** Returns true when the send resolved to something worth closing on. */
  function reportSingle(res: ChaseSendResult, name: string): boolean {
    switch (res.status) {
      case 'sent':
        toast.success(`Chase sent to ${name}`, {
          description: res.escalated
            ? 'Escalated to the next step in the cadence.'
            : 'Logged to their timeline.',
        });
        return true;
      case 'nothing_outstanding':
        toast.success(`${name} is all in`, { description: 'Nothing left to chase — marked complete.' });
        return true;
      case 'already_sent':
        toast.info(`A reminder just went to ${name}`, { description: 'Skipped to avoid a double-send.' });
        return true;
      case 'capped':
        toast.error('Daily send limit reached', { description: 'Try again tomorrow, or lift the cap in settings.' });
        return true;
      case 'blocked_quiet_hours':
        toast.info('Held for quiet hours', {
          description: `Goes out ${new Date(res.nextSlot).toLocaleString()}.`,
        });
        return true;
      case 'no_reachable_channel':
        setError('No reachable channel — every address on file is bounced or opted out.');
        return false;
    }
  }

  function reportBulk(settled: PromiseSettledResult<ChaseSendResult>[]) {
    let sent = 0;
    let allIn = 0;
    let skipped = 0;
    for (const r of settled) {
      if (r.status === 'rejected') skipped++;
      else if (r.value.status === 'sent') sent++;
      else if (r.value.status === 'nothing_outstanding') allIn++;
      else skipped++;
    }
    const notes = [
      allIn > 0 && `${allIn} already complete`,
      skipped > 0 && `${skipped} couldn’t send`,
    ].filter(Boolean) as string[];
    if (sent > 0) {
      toast.success(`Chase sent to ${sent} ${sent === 1 ? 'client' : 'clients'}`, {
        description: notes.join(' · ') || 'Every selected client got today’s reminder.',
      });
    } else {
      toast.error('No reminders went out', {
        description: notes.join(' · ') || 'Nothing was outstanding for the selection.',
      });
    }
  }

  const sendLabel = bulk ? `Send to ${clients.length} clients` : 'Send it now';

  return (
    <Dialog open={open} onOpenChange={(o) => !sending && onOpenChange(o)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{bulk ? `Send chase to ${clients.length} clients` : 'Send chase now'}</DialogTitle>
          <DialogDescription>
            {bulk
              ? 'Read a sample below, then send each client their own reminder.'
              : 'Read the exact reminder before it goes out.'}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[62vh] min-w-0 overflow-y-auto pr-0.5">
          {loading ? (
            <PreviewSkeleton />
          ) : error && !preview ? (
            <Notice tone="danger">{error}</Notice>
          ) : preview ? (
            <div className="swap-in grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
              <MetaRow preview={preview} />

              {preview.outstanding.length > 0 ? (
                <section>
                  <p className="label-eyebrow">
                    Still owes {preview.outstandingCount} of {preview.totalCount}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {preview.outstanding.slice(0, 9).map((item) => (
                      <Badge key={item} variant="outline" className="max-w-full whitespace-normal text-left">
                        {item}
                      </Badge>
                    ))}
                    {preview.outstanding.length > 9 ? (
                      <Badge variant="neutral">+{preview.outstanding.length - 9} more</Badge>
                    ) : null}
                  </div>
                </section>
              ) : null}

              <Recipients preview={preview} canEmail={canEmail} canSms={canSms} />

              {blocked ? (
                <Notice tone="danger">
                  Every address for {lead?.displayName} is bounced or opted out — this reminder can’t be
                  delivered. Fix a contact method first.
                </Notice>
              ) : null}

              {preview.email ? (
                <EmailCard subject={preview.email.subject} body={preview.email.text} />
              ) : null}
              {preview.sms ? <SmsCard text={preview.sms} /> : null}

              {bulk ? (
                <p className="text-2xs text-ink-faint">
                  Preview shows {lead?.displayName}. The other {clients.length - 1}{' '}
                  {clients.length - 1 === 1 ? 'client gets their own reminder' : 'clients each get their own'},
                  built from what they still owe.
                </p>
              ) : null}

              {error && preview ? <Notice tone="danger">{error}</Notice> : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="sm:items-center sm:justify-between">
          <p className="hidden text-2xs text-ink-faint sm:block">
            Sends now, outside the schedule. Opt-outs are always respected.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={sending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSend}
              loading={sending}
              disabled={loading || !preview || blocked}
            >
              <Send className="size-4" />
              {sendLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetaRow({ preview }: { preview: ChasePreview }) {
  const deadlinePassed = preview.daysToDeadline < 0;
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="stamp">Reminder {preview.stepIndex + 1}</Badge>
        <Badge variant="outline">{TONE_LABEL[preview.tone]} tone</Badge>
        <span className="ticket text-2xs text-ink-faint">{preview.channels.join(' · ')}</span>
      </div>
      <p className="tabular-nums text-2xs text-ink-muted">
        {preview.daysWaiting}d waiting ·{' '}
        <span className={cn(deadlinePassed && 'text-status-danger')}>
          {deadlinePassed ? `${Math.abs(preview.daysToDeadline)}d past deadline` : `${preview.daysToDeadline}d to deadline`}
        </span>
      </p>
    </div>
  );
}

function Recipients({
  preview,
  canEmail,
  canSms,
}: {
  preview: ChasePreview;
  canEmail: boolean;
  canSms: boolean;
}) {
  const { emails, phones, emailSuppressed, smsSuppressed } = preview.recipients;
  const showEmail = preview.channels.includes('email');
  const showSms = preview.channels.includes('sms');
  return (
    <section>
      <p className="label-eyebrow">Goes to</p>
      <div className="mt-1.5 grid gap-1.5">
        {showEmail ? (
          <RecipientRow
            Icon={Mail}
            value={emails.length ? emails.join(', ') : 'No email on file'}
            ok={canEmail}
            warn={emailSuppressed ? 'bounced / opted out' : !emails.length ? 'missing' : null}
          />
        ) : null}
        {showSms ? (
          <RecipientRow
            Icon={MessageSquareText}
            value={phones.length ? phones.join(', ') : 'No number on file'}
            ok={canSms}
            warn={smsSuppressed ? 'opted out' : !phones.length ? 'missing' : null}
          />
        ) : null}
      </div>
    </section>
  );
}

function RecipientRow({
  Icon,
  value,
  ok,
  warn,
}: {
  Icon: typeof Mail;
  value: string;
  ok: boolean;
  warn: string | null;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <Icon className={cn('size-3.5 shrink-0', ok ? 'text-ink-muted' : 'text-ink-faint')} />
      <span className={cn('ticket min-w-0 flex-1 truncate', ok ? 'text-ink' : 'text-ink-faint line-through')}>{value}</span>
      {warn ? (
        <span className="rounded-sm bg-status-danger-wash px-1.5 py-0.5 text-2xs font-medium text-status-danger">
          {warn}
        </span>
      ) : null}
    </div>
  );
}

function EmailCard({ subject, body }: { subject: string; body: string }) {
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-surface-sunken">
      <div className="border-b border-line px-3 py-2">
        <p className="label-eyebrow text-ink-faint">Email</p>
        <p className="mt-0.5 text-sm font-semibold leading-snug text-ink">{subject}</p>
      </div>
      <p className="whitespace-pre-wrap break-words px-3 py-3 text-xs leading-relaxed text-ink-muted">{body}</p>
    </section>
  );
}

function SmsCard({ text }: { text: string }) {
  return (
    <section>
      <p className="label-eyebrow">Text message</p>
      <p className="mt-1.5 w-fit max-w-[85%] rounded-2xl rounded-bl-sm bg-status-info-wash px-3 py-2 text-xs leading-relaxed text-ink">
        {text}
      </p>
    </section>
  );
}

function Notice({ tone, children }: { tone: 'danger'; children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border px-3 py-2 text-xs',
        tone === 'danger' && 'border-status-danger/20 bg-status-danger-wash text-status-danger',
      )}
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-40 rounded-sm" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="space-y-1.5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-5 w-full rounded-sm" />
      </div>
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-12 w-3/4 rounded-2xl" />
    </div>
  );
}
