import { useState } from 'react';
import { AlertTriangle, Mail, MessageSquare } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';
import { cn } from '@/lib/cn';
import { ToneBadge } from './chaseUi';
import type { PreviewResult } from './actions';

/** The exact message, before it sends. A partner reads this and decides to trust
 *  the automation — so it shows the real subject, body, recipients and who's suppressed. */
export function MessagePreview({ preview, firmName }: { preview: PreviewResult; firmName: string }) {
  const hasEmail = preview.email !== null;
  const hasSms = preview.sms !== null;
  const [tab, setTab] = useState(hasEmail ? 'email' : 'sms');

  if (!hasEmail && !hasSms) {
    return (
      <div className="rounded-xl border border-line bg-surface-sunken/40 px-4 py-6 text-center">
        <p className="text-sm font-medium text-ink">Nothing queued to send</p>
        <p className="mt-1 text-[13px] text-ink-muted">
          {preview.outstandingCount === 0
            ? 'Every requested document is in — nothing left to chase.'
            : 'No reachable channel for this step.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-2xs text-ink-faint">
          Step {preview.stepIndex + 1} of the cadence · asks for {preview.outstandingCount}{' '}
          {preview.outstandingCount === 1 ? 'document' : 'documents'}
        </p>
        <ToneBadge tone={preview.tone} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        {hasEmail && hasSms && (
          <TabsList className="mb-3">
            <TabsTrigger value="email">
              <Mail className="size-3.5" /> Email
            </TabsTrigger>
            <TabsTrigger value="sms">
              <MessageSquare className="size-3.5" /> SMS
            </TabsTrigger>
          </TabsList>
        )}

        {hasEmail && preview.email && (
          <TabsContent value="email">
            <EmailCard
              subject={preview.email.subject}
              body={preview.email.text}
              recipients={preview.recipients.emails}
              suppressed={preview.recipients.emailSuppressed}
              firmName={firmName}
            />
          </TabsContent>
        )}

        {hasSms && preview.sms && (
          <TabsContent value="sms">
            <SmsCard body={preview.sms} recipients={preview.recipients.phones} suppressed={preview.recipients.smsSuppressed} />
          </TabsContent>
        )}
      </Tabs>

      {preview.outstanding.length > 0 && (
        <div>
          <p className="label-eyebrow mb-1.5 text-ink-faint">Documents named in this message</p>
          <div className="flex flex-wrap gap-1.5">
            {preview.outstanding.map((label, i) => (
              <span
                key={`${label}-${i}`}
                className="ticket rounded-md border border-line bg-surface px-1.5 py-0.5 text-ink-muted"
              >
                {chipCode(label)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** `outstanding` arrives from the engine as reader-facing strings —
 *  "Wage and Tax Statement (W-2)", "Signed Engagement Letter (Engagement)",
 *  or a bespoke request label. The trailing parenthetical is the short code,
 *  which is the scannable bit; fall back to the whole label when there isn't one. */
function chipCode(label: string): string {
  const m = label.match(/\(([^)]+)\)\s*$/);
  return m ? m[1] : label;
}

function RecipientLine({ label, recipients, suppressed, suppressedNote }: { label: string; recipients: string[]; suppressed: boolean; suppressedNote: string }) {
  return (
    <div className="flex items-center gap-2 text-2xs">
      <span className="text-ink-faint">{label}</span>
      {suppressed || recipients.length === 0 ? (
        <span className="inline-flex items-center gap-1 text-status-danger">
          <AlertTriangle className="size-3" /> {suppressedNote}
        </span>
      ) : (
        <span className="ticket text-ink-muted">{recipients.join(', ')}</span>
      )}
    </div>
  );
}

function EmailCard({ subject, body, recipients, suppressed, firmName }: { subject: string; body: string; recipients: string[]; suppressed: boolean; firmName: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <div className="space-y-1.5 border-b border-line bg-surface-sunken/40 px-4 py-3">
        <RecipientLine label="To" recipients={recipients} suppressed={suppressed} suppressedNote="Email suppressed — bounced or opted out" />
        <div className="flex items-baseline gap-2">
          <span className="text-2xs text-ink-faint">Subject</span>
          <span className="text-[13px] font-medium text-ink">{subject}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-2xs text-ink-faint">From</span>
          <span className="text-[13px] text-ink-muted">{firmName}</span>
        </div>
      </div>
      <div className="max-h-64 overflow-y-auto whitespace-pre-wrap px-4 py-3.5 text-[13px] leading-relaxed text-ink">{body}</div>
    </div>
  );
}

function SmsCard({ body, recipients, suppressed }: { body: string; recipients: string[]; suppressed: boolean }) {
  const segments = Math.max(1, Math.ceil(body.length / 160));
  return (
    <div className="space-y-2">
      <RecipientLine label="To" recipients={recipients} suppressed={suppressed} suppressedNote="No number or opted out of SMS" />
      <div className="flex">
        <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-ink px-3.5 py-2.5 text-[13px] leading-relaxed text-paper">{body}</div>
      </div>
      <p className={cn('text-2xs tabular-nums text-ink-faint', body.length > 160 && 'text-status-warn')}>
        {body.length} characters · {segments} {segments === 1 ? 'segment' : 'segments'}
      </p>
    </div>
  );
}
