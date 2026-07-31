import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import {
  CHASE_PROFILES,
  ROLE_RANK,
  type ChaseProfileId,
  type ChaseSettings,
} from '@taxfax/shared';
import { useAuth } from '@/lib/auth';
import { firebaseErrorMessage } from '@/lib/errors';
import { Field } from '@/components/ui/Field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Textarea } from '@/components/ui/Textarea';
import { toast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { SettingsHeader, FieldGrid, ToggleRow } from '@/components/settings/layout';
import { SaveBar } from '@/components/settings/SaveBar';
import { useDraft } from '@/components/settings/useDraft';
import { updateFirm } from '@/components/settings/api';
import { CadencePreview } from '@/components/settings/CadencePreview';

export const Route = createFileRoute('/_app/settings/cadence')({
  component: CadencePage,
});

const PROFILE_ORDER: ChaseProfileId[] = ['gentle', 'standard', 'relentless'];

type CadenceDraft = Omit<ChaseSettings, 'deadline'>;

function formatHour(h: number): string {
  const meridiem = h < 12 ? 'AM' : 'PM';
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve}:00 ${meridiem}`;
}

function formatDeadline(mmdd: string): string {
  const [m, d] = mmdd.split('-').map(Number);
  if (!m || !d) return mmdd;
  const name = new Date(Date.UTC(2001, m - 1, d)).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return name;
}

function CadencePage() {
  const { activeFirm, user } = useAuth();
  const firm = activeFirm?.firm;
  const canEdit = activeFirm ? ROLE_RANK[activeFirm.role] >= ROLE_RANK.admin : false;

  if (!firm) return <CadenceSkeleton />;

  const chase = firm.chase;
  const initial: CadenceDraft = {
    enabled: chase.enabled,
    profile: chase.profile,
    quietHours: chase.quietHours,
    sendOnWeekends: chase.sendOnWeekends,
    escalateAfterStep: Math.min(
      chase.escalateAfterStep,
      CHASE_PROFILES[chase.profile].steps.length - 1,
    ),
    smsEnabled: chase.smsEnabled,
    signature: chase.signature,
  };

  return (
    <CadenceForm
      key={firm.id}
      firmId={firm.id}
      canEdit={canEdit}
      initial={initial}
      deadline={chase.deadline}
      timezone={firm.timezone}
      firmName={firm.branding.displayName || firm.name}
      slug={firm.slug}
      preparerName={user?.displayName?.trim() || 'Your preparer'}
    />
  );
}

function CadenceForm({
  firmId,
  canEdit,
  initial,
  deadline,
  timezone,
  firmName,
  slug,
  preparerName,
}: {
  firmId: string;
  canEdit: boolean;
  initial: CadenceDraft;
  deadline: string;
  timezone: string;
  firmName: string;
  slug: string;
  preparerName: string;
}) {
  const { value, set, patch, dirty, reset, commit } = useDraft(initial);
  const [saving, setSaving] = useState(false);
  const disabled = !canEdit;

  const steps = CHASE_PROFILES[value.profile].steps;
  const previewSettings: ChaseSettings = { ...value, deadline };

  function selectProfile(id: ChaseProfileId) {
    const maxStep = CHASE_PROFILES[id].steps.length - 1;
    patch({ profile: id, escalateAfterStep: Math.min(value.escalateAfterStep, maxStep) });
  }

  async function save() {
    setSaving(true);
    try {
      await updateFirm(firmId, {
        'chase.enabled': value.enabled,
        'chase.profile': value.profile,
        'chase.quietHours': value.quietHours,
        'chase.sendOnWeekends': value.sendOnWeekends,
        'chase.smsEnabled': value.smsEnabled,
        'chase.escalateAfterStep': value.escalateAfterStep,
        'chase.signature': value.signature.trim(),
      });
      commit();
      toast.success('Chase cadence saved.');
    } catch (err) {
      toast.error(firebaseErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SettingsHeader
        title="Chase cadence"
        description="How hard TaxFax follows up until a client's documents are all in. Every change here changes what real people receive — so it previews live before you save."
      />

      {!canEdit ? (
        <p className="mt-6 rounded-lg border border-line bg-surface-sunken px-3.5 py-2.5 text-2xs text-ink-muted">
          Only owners and admins can change the cadence. This is what's set for your firm today.
        </p>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,23rem)]">
        <div className="min-w-0 space-y-8">
          <Group
            title="Automatic chasing"
            description="The master switch for the whole firm."
          >
            <ToggleRow
              label="Chase clients automatically"
              description="When on, TaxFax emails and texts clients on the schedule at right until every document is in. Turn it off to pause every client at once."
              checked={value.enabled}
              onCheckedChange={(v) => set('enabled', v)}
              disabled={disabled}
            />
          </Group>

          <Group
            title="How hard to push"
            description="Three profiles, from a light touch to daily-until-filed. You can change this per client later."
          >
            <RadioGroup
              value={value.profile}
              onValueChange={(v) => selectProfile(v as ChaseProfileId)}
              disabled={disabled}
              className="gap-2"
              aria-label="Cadence profile"
            >
              {PROFILE_ORDER.map((id) => {
                const p = CHASE_PROFILES[id];
                const selected = value.profile === id;
                return (
                  <label
                    key={id}
                    htmlFor={`profile-${id}`}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3',
                      'transition-colors duration-100 ease-out-quint',
                      selected
                        ? 'border-line-strong bg-surface-sunken'
                        : 'border-line bg-surface hover:bg-surface-sunken/50',
                      disabled && 'cursor-not-allowed opacity-70',
                    )}
                  >
                    <RadioGroupItem id={`profile-${id}`} value={id} className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink">{p.label}</span>
                      <span className="mt-0.5 block text-pretty text-2xs leading-relaxed text-ink-faint">
                        {p.description}
                      </span>
                    </span>
                  </label>
                );
              })}
            </RadioGroup>
          </Group>

          <Group
            title="Channels & handoff"
            description="Email always sends. Choose whether to add SMS and when a human takes over."
          >
            <ToggleRow
              label="Send text messages too"
              description="Adds SMS to the steps that use it. Texting lifts response rates, but each message has a cost — email alone still works."
              checked={value.smsEnabled}
              onCheckedChange={(v) => set('smsEnabled', v)}
              disabled={disabled}
            />
            <Field
              label="Hand off to the preparer after"
              hint="TaxFax stops chasing and pings the assigned preparer to call the client directly."
            >
              <Select
                value={String(value.escalateAfterStep)}
                disabled={disabled}
                onValueChange={(v) => set('escalateAfterStep', Number(v))}
              >
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {steps.map((s) => (
                    <SelectItem key={s.index} value={String(s.index)}>
                      {s.index === steps.length - 1
                        ? `All ${steps.length} messages, then hand off`
                        : `${s.index + 1} message${s.index === 0 ? '' : 's'}, then hand off`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </Group>

          <Group
            title="When it's polite to send"
            description="Quiet hours and weekends are respected in your firm's timezone. Anything due inside them waits."
          >
            <FieldGrid>
              <Field label="Quiet from" hint="No messages after this hour.">
                <Select
                  value={String(value.quietHours.start)}
                  disabled={disabled}
                  onValueChange={(v) =>
                    patch({ quietHours: { ...value.quietHours, start: Number(v) } })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, h) => (
                      <SelectItem key={h} value={String(h)}>
                        {formatHour(h)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Quiet until" hint="Messages resume at this hour.">
                <Select
                  value={String(value.quietHours.end)}
                  disabled={disabled}
                  onValueChange={(v) =>
                    patch({ quietHours: { ...value.quietHours, end: Number(v) } })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, h) => (
                      <SelectItem key={h} value={String(h)}>
                        {formatHour(h)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </FieldGrid>
            <ToggleRow
              label="Send on weekends"
              description="Off by default — Saturday and Sunday sends wait for Monday morning."
              checked={value.sendOnWeekends}
              onCheckedChange={(v) => set('sendOnWeekends', v)}
              disabled={disabled}
            />
          </Group>

          <Group
            title="Sign-off"
            description="Added to the end of every message."
          >
            <Field
              label="Signature"
              hint="Leave blank to sign with your name and firm automatically."
            >
              <Textarea
                value={value.signature}
                disabled={disabled}
                onChange={(e) => set('signature', e.target.value)}
                placeholder={`— ${preparerName} at ${firmName}`}
                rows={2}
                maxLength={200}
              />
            </Field>
            <p className="text-2xs text-ink-faint">
              Counting down to{' '}
              <span className="font-medium text-ink-muted">{formatDeadline(deadline)}</span>.{' '}
              <Link
                to="/settings/profile"
                className="rounded-xs font-medium text-ink-muted underline-offset-2 hover:text-ink hover:underline"
              >
                Change the deadline in Firm profile
              </Link>
              .
            </p>
          </Group>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-xl border border-line bg-surface-sunken/40 p-4 sm:p-5">
            <CadencePreview
              settings={previewSettings}
              timezone={timezone}
              firmName={firmName}
              slug={slug}
              preparerName={preparerName}
            />
          </div>
        </aside>
      </div>

      {canEdit ? (
        <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={reset} saveLabel="Save cadence" />
      ) : null}
    </div>
  );
}

function Group({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 border-t border-line pt-6 first:border-t-0 first:pt-0">
      <div>
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-pretty text-2xs leading-relaxed text-ink-faint">{description}</p>
      </div>
      {children}
    </section>
  );
}

function CadenceSkeleton() {
  return (
    <div>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-3 h-4 w-full max-w-xl" />
      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,23rem)]">
        <div className="space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-16 w-full" />
            </div>
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    </div>
  );
}
