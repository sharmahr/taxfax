import { Link } from '@tanstack/react-router';
import { ChevronLeft, Copy, MoreHorizontal, Phone, Plus, Send } from 'lucide-react';
import {
  CLIENT_STAGE_LABEL,
  ENTITY_TYPE_LABEL,
  FILING_STATUS_LABEL,
  type ClientStage,
} from '@taxfax/shared';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { ClientStagePill } from '@/components/ui/StatusPill';
import { toast } from '@/components/ui/Toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { Assignee, ContactFlags, Tags } from '../bits';
import type { MembersIndex } from '../hooks';
import { assignClient, run, setStage } from '../actions';
import type { ClientDoc, DerivedClient } from '../model';

const STAGES = Object.keys(CLIENT_STAGE_LABEL) as ClientStage[];

interface DetailHeaderProps {
  d: DerivedClient;
  members: MembersIndex;
  firmId: string;
  chaseable: boolean;
  sendLabel?: string;
  onSendChase: () => void;
  onAddRequest: () => void;
}

export function DetailHeader({
  d,
  members,
  firmId,
  chaseable,
  sendLabel = 'Send chase',
  onSendChase,
  onAddRequest,
}: DetailHeaderProps) {
  const c: ClientDoc = d.client;
  const owner = c.assignedTo ? members.byId.get(c.assignedTo) : undefined;
  const email = c.primaryContact?.email;

  const copyEmail = () => {
    if (!email) return;
    void navigator.clipboard?.writeText(email);
    toast.success('Email address copied');
  };

  return (
    <header>
      <Link
        to="/clients"
        className="inline-flex items-center gap-1 text-2xs font-medium text-ink-muted transition-colors hover:text-ink"
      >
        <ChevronLeft className="size-3.5" />
        All clients
      </Link>

      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="label-eyebrow">
            {ENTITY_TYPE_LABEL[c.entityType]}
            {c.filingStatus ? ` · ${FILING_STATUS_LABEL[c.filingStatus]}` : ''} · TY {c.priorYear?.taxYear ?? ''}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="display text-3xl leading-tight text-ink">{c.displayName}</h1>
            <ClientStagePill stage={c.stage} />
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
            {email ? <span className="ticket text-ink-muted">{email}</span> : null}
            {c.primaryContact?.phone ? (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Phone className="size-3 text-ink-faint" />
                {c.primaryContact.phone}
              </span>
            ) : null}
            <ContactFlags emailBounced={d.emailBounced} smsOptOut={d.smsOptOut} />
            {c.secondaryContact?.name ? (
              <span className="text-ink-faint">+ {c.secondaryContact.name}</span>
            ) : null}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Assignee member={owner} showName />
            <Tags tags={c.tags ?? []} max={4} />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {chaseable ? (
            <Button variant="primary" onClick={onSendChase}>
              <Send className="size-4" />
              {sendLabel}
            </Button>
          ) : null}
          <Button variant="secondary" onClick={onAddRequest}>
            <Plus className="size-4" />
            Add request
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" iconOnly aria-label="More client actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Assign to</DropdownMenuLabel>
              {members.list.map((m) => (
                <DropdownMenuItem
                  key={m.uid}
                  className={cn(c.assignedTo === m.uid && 'font-medium text-ink')}
                  onSelect={() =>
                    void run(assignClient(firmId, c.id, m.uid), { success: `Assigned to ${m.name}` })
                  }
                >
                  <Assignee member={m} />
                  {m.name}
                </DropdownMenuItem>
              ))}
              {c.assignedTo ? (
                <DropdownMenuItem
                  onSelect={() => void run(assignClient(firmId, c.id, null), { success: 'Unassigned' })}
                >
                  Unassign
                </DropdownMenuItem>
              ) : null}

              <DropdownMenuSeparator />
              <DropdownMenuLabel>Set stage</DropdownMenuLabel>
              {STAGES.map((s) => (
                <DropdownMenuItem
                  key={s}
                  className={cn(c.stage === s && 'font-medium text-ink')}
                  onSelect={() =>
                    void run(setStage(firmId, c.id, s), { success: `Stage set to ${CLIENT_STAGE_LABEL[s]}` })
                  }
                >
                  {CLIENT_STAGE_LABEL[s]}
                </DropdownMenuItem>
              ))}

              {email ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={copyEmail}>
                    <Copy className="size-4" />
                    Copy email address
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
