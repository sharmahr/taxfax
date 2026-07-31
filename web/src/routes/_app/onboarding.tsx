import { useMemo, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  PartyPopper,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import {
  CHASE_PROFILES,
  docType,
  emptyPriorYear,
  generateChecklist,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  ROLE_RANK,
  type ChaseProfileId,
  type ChaseSettings,
  type Firm,
  type FirmRole,
  type PriorYearReturn,
  type RequestPriority,
} from '@taxfax/shared';
import { useAuth } from '@/lib/auth';
import { firebaseErrorMessage } from '@/lib/errors';
import { usePageTitle } from '@/components/shell';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { toast } from '@/components/ui/Toast';
import { ToggleRow } from '@/components/settings/layout';
import {
  inviteMember,
  markOnboardingStep,
  updateFirm,
  type InviteResult,
} from '@/components/settings/api';
import { normEmail } from '@/components/onboarding/csv';
import { ONBOARDING_STEPS, onboardingProgress } from '@/components/onboarding/steps';
import { ImportClients } from '@/components/onboarding/ImportClients';
import { CadencePreview } from '@/components/settings/CadencePreview';

export const Route = createFileRoute('/_app/onboarding')({
  component: OnboardingPage,
});

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern — New York' },
  { value: 'America/Chicago', label: 'Central — Chicago' },
  { value: 'America/Denver', label: 'Mountain — Denver' },
  { value: 'America/Phoenix', label: 'Mountain (no DST) — Phoenix' },
  { value: 'America/Los_Angeles', label: 'Pacific — Los Angeles' },
  { value: 'America/Anchorage', label: 'Alaska — Anchorage' },
  { value: 'Pacific/Honolulu', label: 'Hawaii — Honolulu' },
];

const TOTAL = ONBOARDING_STEPS.length;

function OnboardingPage() {
  usePageTitle('Set up your firm');
  const { activeFirm, user } = useAuth();
  const firm = activeFirm?.firm;
  const navigate = useNavigate();

  const progress = onboardingProgress(firm ?? null);
  const [stepIndex, setStepIndex] = useState(() =>
    progress.complete ? TOTAL : progress.nextIndex,
  );

  if (!firm) return <OnboardingSkeleton />;

  const firmId = firm.id;
  const canManage = activeFirm ? ROLE_RANK[activeFirm.role] >= ROLE_RANK.admin : false;

  async function complete(stepId: string) {
    try {
      await markOnboardingStep(firmId, stepId);
    } catch {
      // A failed progress write shouldn't block the person — the step still worked.
    }
  }
  function go(next: number) {
    setStepIndex(Math.max(0, Math.min(TOTAL, next)));
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function advance(stepId: string) {
    await complete(stepId);
    go(stepIndex + 1);
  }
  function finish() {
    navigate({ to: '/dashboard' });
  }

  const onDone = stepIndex >= TOTAL;
  const currentId = ONBOARDING_STEPS[Math.min(stepIndex, TOTAL - 1)].id;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-eyebrow text-stamp-ink">Welcome to TaxFax</p>
          <h1 className="display mt-1 text-3xl text-ink sm:text-4xl">
            Let's get your firm chasing.
          </h1>
          <p className="mt-2 max-w-prose text-pretty text-sm text-ink-muted">
            Five short steps. You can skip any of them, jump around, and come back later — your
            workspace works after the very first one.
          </p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/dashboard">Finish later</Link>
        </Button>
      </header>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
        <StepRail
          firm={firm}
          activeIndex={onDone ? TOTAL : stepIndex}
          onJump={(i) => go(i)}
        />

        <div className="min-w-0">
          {onDone ? (
            <DoneScreen firm={firm} onFinish={finish} onReview={() => go(0)} />
          ) : (
            <div key={currentId}>
              {currentId === 'profile' ? (
                <ProfileStep
                  firm={firm}
                  firmId={firmId}
                  canManage={canManage}
                  onContinue={() => advance('profile')}
                  onSkip={() => go(stepIndex + 1)}
                />
              ) : null}
              {currentId === 'import' ? (
                <ImportStep
                  firmId={firmId}
                  taxYear={firm.taxYear}
                  canManage={
                    activeFirm ? ROLE_RANK[activeFirm.role] >= ROLE_RANK.preparer : false
                  }
                  onComplete={() => complete('import')}
                  onContinue={() => go(stepIndex + 1)}
                  onSkip={() => go(stepIndex + 1)}
                  onBack={() => go(stepIndex - 1)}
                />
              ) : null}
              {currentId === 'priorYear' ? (
                <PriorYearStep
                  firm={firm}
                  onContinue={() => advance('priorYear')}
                  onSkip={() => go(stepIndex + 1)}
                  onBack={() => go(stepIndex - 1)}
                />
              ) : null}
              {currentId === 'team' ? (
                <TeamStep
                  firmId={firmId}
                  canManage={canManage}
                  onContinue={() => advance('team')}
                  onSkip={() => go(stepIndex + 1)}
                  onBack={() => go(stepIndex - 1)}
                />
              ) : null}
              {currentId === 'cadence' ? (
                <CadenceStep
                  firm={firm}
                  firmId={firmId}
                  canManage={canManage}
                  preparerName={user?.displayName?.trim() || 'Your preparer'}
                  onContinue={() => advance('cadence')}
                  onSkip={() => advance('cadence')}
                  onBack={() => go(stepIndex - 1)}
                />
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepRail({
  firm,
  activeIndex,
  onJump,
}: {
  firm: Firm;
  activeIndex: number;
  onJump: (i: number) => void;
}) {
  const done = new Set(firm.onboarding?.completedSteps ?? []);
  return (
    <nav aria-label="Setup steps" className="lg:sticky lg:top-2 lg:self-start">
      <ol className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {ONBOARDING_STEPS.map((s, i) => {
          const isDone = done.has(s.id);
          const isActive = i === activeIndex;
          return (
            <li key={s.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onJump(i)}
                aria-current={isActive ? 'step' : undefined}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left',
                  'transition-colors duration-100 ease-out-quint',
                  isActive ? 'bg-surface-sunken' : 'hover:bg-surface-sunken/50',
                )}
              >
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full border text-2xs font-medium tabular-nums',
                    isDone
                      ? 'border-transparent bg-ink text-paper'
                      : isActive
                        ? 'border-ink text-ink'
                        : 'border-line-strong text-ink-faint',
                  )}
                >
                  {isDone ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={cn(
                      'block whitespace-nowrap text-sm font-medium lg:whitespace-normal',
                      isActive ? 'text-ink' : 'text-ink-muted',
                    )}
                  >
                    {s.title}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function StepCard({
  step,
  children,
}: {
  step: (typeof ONBOARDING_STEPS)[number];
  children: React.ReactNode;
}) {
  return (
    <section aria-label={step.title}>
      <h2 className="display text-2xl text-ink sm:text-[1.75rem]">{step.title}</h2>
      <p className="mt-1.5 max-w-prose text-pretty text-sm text-ink-muted">{step.blurb}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function StepFooter({
  onContinue,
  onSkip,
  onBack,
  continueLabel = 'Continue',
  continueLoading,
  continueDisabled,
}: {
  onContinue: () => void;
  onSkip?: () => void;
  onBack?: () => void;
  continueLabel?: string;
  continueLoading?: boolean;
  continueDisabled?: boolean;
}) {
  return (
    <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
      <div>
        {onBack ? (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {onSkip ? (
          <Button variant="ghost" size="sm" onClick={onSkip}>
            Skip for now
          </Button>
        ) : null}
        <Button
          variant="primary"
          onClick={onContinue}
          loading={continueLoading}
          disabled={continueDisabled}
        >
          {continueLabel}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function ProfileStep({
  firm,
  firmId,
  canManage,
  onContinue,
  onSkip,
}: {
  firm: Firm;
  firmId: string;
  canManage: boolean;
  onContinue: () => void;
  onSkip: () => void;
}) {
  const [name, setName] = useState(firm.name);
  const [replyTo, setReplyTo] = useState(firm.branding.replyToEmail ?? '');
  const [timezone, setTimezone] = useState(firm.timezone);
  const [saving, setSaving] = useState(false);

  const nameError = name.trim().length === 0 ? 'Your firm needs a name.' : undefined;
  const emailError =
    replyTo.trim() && !normEmail(replyTo) ? "That doesn't look like a valid email." : undefined;
  const blocked = Boolean(nameError || emailError);

  async function save() {
    if (blocked || !canManage) {
      if (!canManage) onContinue();
      return;
    }
    setSaving(true);
    try {
      await updateFirm(firmId, {
        name: name.trim(),
        timezone,
        'branding.replyToEmail': replyTo.trim(),
      });
      onContinue();
    } catch (err) {
      toast.error(firebaseErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <StepCard step={ONBOARDING_STEPS[0]}>
      <div className="space-y-5">
        <Field label="Firm name" error={nameError} required>
          <Input
            value={name}
            disabled={!canManage}
            onChange={(e) => setName(e.target.value)}
            placeholder="Whitfield & Rowe CPAs"
            autoComplete="organization"
          />
        </Field>
        <Field
          label="Reply-to email"
          error={emailError}
          hint="Where a client's reply to a reminder lands. You can add branding and a logo later in Settings."
        >
          <Input
            type="email"
            value={replyTo}
            disabled={!canManage}
            onChange={(e) => setReplyTo(e.target.value)}
            placeholder="team@whitfieldrowe.com"
            autoComplete="email"
          />
        </Field>
        <Field label="Timezone" hint="Reminders respect quiet hours in this zone.">
          <Select value={timezone} disabled={!canManage} onValueChange={setTimezone}>
            <SelectTrigger className="sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(TIMEZONES.some((t) => t.value === timezone)
                ? TIMEZONES
                : [{ value: timezone, label: timezone }, ...TIMEZONES]
              ).map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <StepFooter
        onContinue={save}
        onSkip={onSkip}
        continueLoading={saving}
        continueDisabled={blocked}
        continueLabel="Save & continue"
      />
    </StepCard>
  );
}

function ImportStep({
  firmId,
  taxYear,
  canManage,
  onComplete,
  onContinue,
  onSkip,
  onBack,
}: {
  firmId: string;
  taxYear: number;
  canManage: boolean;
  onComplete: () => void;
  onContinue: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [imported, setImported] = useState(false);

  return (
    <StepCard step={ONBOARDING_STEPS[1]}>
      <ImportClients
        firmId={firmId}
        taxYear={taxYear}
        canImport={canManage}
        onImported={() => {
          setImported(true);
          onComplete();
        }}
      />
      <StepFooter
        onBack={onBack}
        onContinue={onContinue}
        onSkip={imported ? undefined : onSkip}
      />
    </StepCard>
  );
}

function PriorYearStep({
  firm,
  onContinue,
  onSkip,
  onBack,
}: {
  firm: Firm;
  onContinue: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const demo = useMemo<PriorYearReturn>(
    () => ({
      ...emptyPriorYear(firm.taxYear - 1),
      formType: '1040',
      filingStatus: 'mfj',
      taxpayerName: 'Jordan Rivera',
      spouseName: 'Sam Rivera',
      dependents: 2,
      state: 'CA',
      schedules: ['1', 'A', 'B', 'E'],
      lines: { '1z': 184000, '2b': 940, '3a': 1240 },
      issuers: [
        { docTypeId: 'w2', name: 'Acme Corp' },
        { docTypeId: 'w2', name: 'Globex' },
        { docTypeId: '1099-int', name: 'First National Bank' },
        { docTypeId: '1099-div', name: 'Vanguard' },
      ],
      itemized: true,
      documentCounts: { w2: 2, '1099-int': 1, '1099-div': 1, 'rental-summary': 1 },
      confidence: 0.92,
    }),
    [firm.taxYear],
  );

  const hits = useMemo(
    () => generateChecklist({ prior: demo, taxYear: demo.taxYear + 1 }),
    [demo],
  );
  const filingYear = firm.taxYear;

  return (
    <StepCard step={ONBOARDING_STEPS[2]}>
      <div className="rounded-xl border border-line bg-surface-sunken/40 p-4 sm:p-5">
        <div className="flex items-start gap-2.5">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-stamp-wash text-stamp-ink">
            <Sparkles className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">
              A sample {demo.taxYear} return, read by TaxFax
            </p>
            <p className="mt-0.5 text-2xs leading-relaxed text-ink-faint">
              Married-filing-jointly 1040 with two W-2s, interest, dividends, and a Schedule E
              rental. Here's the {filingYear} checklist it produced — the moment a client's real
              prior-year return lands, this happens on its own.
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-1.5">
          {hits.map((hit) => {
            const def = docType(hit.docTypeId);
            return (
              <li
                key={hit.docTypeId}
                className="flex items-start gap-3 rounded-lg border border-line bg-surface px-3 py-2.5"
              >
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-status-success-wash text-status-success">
                  <Check className="size-3" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-medium text-ink">{def.code}</span>
                    {hit.quantity > 1 ? (
                      <span className="text-2xs tabular-nums text-ink-faint">×{hit.quantity}</span>
                    ) : null}
                    <span className="truncate text-2xs text-ink-faint">{def.label}</span>
                    <PriorityTag priority={hit.priority} />
                  </div>
                  <p className="mt-0.5 text-pretty text-2xs leading-relaxed text-ink-faint">
                    {hit.reason}
                    {hit.issuers.length > 0 ? (
                      <span className="text-ink-muted"> — {hit.issuers.join(', ')}</span>
                    ) : null}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="mt-3 text-2xs text-ink-faint">
          <span className="font-medium text-ink-muted">{hits.length} documents</span> to collect,
          built from one PDF — no checklist typed by hand.
        </p>
      </div>

      <StepFooter
        onBack={onBack}
        onContinue={onContinue}
        onSkip={onSkip}
        continueLabel="Makes sense — continue"
      />
    </StepCard>
  );
}

function PriorityTag({ priority }: { priority: RequestPriority }) {
  const label =
    priority === 'critical' ? 'Must have' : priority === 'optional' ? 'If it applies' : 'Standard';
  return (
    <span
      className={cn(
        'rounded px-1 text-2xs font-medium uppercase tracking-wide',
        priority === 'critical' ? 'text-stamp-ink' : 'text-ink-faint',
      )}
    >
      {label}
    </span>
  );
}

const INVITE_ROLES: FirmRole[] = ['admin', 'preparer', 'viewer'];

function TeamStep({
  firmId,
  canManage,
  onContinue,
  onSkip,
  onBack,
}: {
  firmId: string;
  canManage: boolean;
  onContinue: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<FirmRole>('preparer');
  const [busy, setBusy] = useState(false);
  const [invited, setInvited] = useState<InviteResult[]>([]);

  const emailError = email.trim() && !normEmail(email) ? "That email doesn't look right." : undefined;

  async function invite() {
    const clean = normEmail(email);
    if (!clean) return;
    setBusy(true);
    try {
      const res = await inviteMember({ firmId, email: clean, role });
      setInvited((prev) => [res, ...prev.filter((i) => i.email !== res.email)]);
      setEmail('');
      toast.success(res.resent ? 'Invitation resent.' : `Invited ${res.email}.`);
    } catch (err) {
      toast.error(firebaseErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <StepCard step={ONBOARDING_STEPS[3]}>
      {!canManage ? (
        <p className="rounded-lg border border-line bg-surface-sunken px-3.5 py-2.5 text-2xs text-ink-muted">
          Your role can't invite people. An owner or admin can add the team from Settings.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <Field label="Colleague's email" error={emailError} className="flex-1">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && normEmail(email)) {
                    e.preventDefault();
                    void invite();
                  }
                }}
                placeholder="colleague@yourfirm.com"
                autoComplete="off"
              />
            </Field>
            <Field label="Role" className="sm:w-44">
              <Select value={role} onValueChange={(v) => setRole(v as FirmRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVITE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <p className="mt-2 text-2xs leading-relaxed text-ink-faint">{ROLE_DESCRIPTION[role]}</p>

          <div className="mt-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={invite}
              loading={busy}
              disabled={!normEmail(email)}
            >
              <UserPlus className="size-4" />
              Send invite
            </Button>
          </div>

          {invited.length > 0 ? (
            <ul className="mt-5 space-y-2 border-t border-line pt-4">
              {invited.map((inv) => (
                <InvitedRow key={inv.email} invite={inv} />
              ))}
            </ul>
          ) : (
            <p className="mt-5 border-t border-line pt-4 text-2xs text-ink-faint">
              Flying solo this season? That's fine — skip ahead and invite people whenever you like.
            </p>
          )}
        </>
      )}

      <StepFooter onBack={onBack} onContinue={onContinue} onSkip={onSkip} />
    </StepCard>
  );
}

function InvitedRow({ invite }: { invite: InviteResult }) {
  const link = `${window.location.origin}/invite/${invite.token}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Invite link copied.');
    } catch {
      toast.error('Could not copy — select the link and copy it manually.');
    }
  }
  return (
    <li className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm text-ink">{invite.email}</p>
        <p className="text-2xs text-ink-faint">Invited as {ROLE_LABEL[invite.role]}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={copy}>
        <Copy className="size-3.5" />
        Copy link
      </Button>
    </li>
  );
}

function CadenceStep({
  firm,
  firmId,
  canManage,
  preparerName,
  onContinue,
  onSkip,
  onBack,
}: {
  firm: Firm;
  firmId: string;
  canManage: boolean;
  preparerName: string;
  onContinue: () => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  const [profile, setProfile] = useState<ChaseProfileId>(firm.chase.profile);
  const [smsEnabled, setSmsEnabled] = useState(firm.chase.smsEnabled);
  const [enabled, setEnabled] = useState(firm.chase.enabled);
  const [saving, setSaving] = useState(false);

  const settings: ChaseSettings = {
    ...firm.chase,
    profile,
    smsEnabled,
    enabled,
    escalateAfterStep: Math.min(
      firm.chase.escalateAfterStep,
      CHASE_PROFILES[profile].steps.length - 1,
    ),
  };

  async function save() {
    if (!canManage) {
      onContinue();
      return;
    }
    setSaving(true);
    try {
      await updateFirm(firmId, {
        'chase.profile': profile,
        'chase.smsEnabled': smsEnabled,
        'chase.enabled': enabled,
        'chase.escalateAfterStep': settings.escalateAfterStep,
      });
      onContinue();
    } catch (err) {
      toast.error(firebaseErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <StepCard step={ONBOARDING_STEPS[4]}>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <div className="min-w-0 space-y-5">
          <RadioGroup
            value={profile}
            onValueChange={(v) => setProfile(v as ChaseProfileId)}
            disabled={!canManage}
            className="gap-2"
            aria-label="Cadence profile"
          >
            {(['gentle', 'standard', 'relentless'] as ChaseProfileId[]).map((id) => {
              const p = CHASE_PROFILES[id];
              const selected = profile === id;
              return (
                <label
                  key={id}
                  htmlFor={`ob-profile-${id}`}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3',
                    'transition-colors duration-100 ease-out-quint',
                    selected
                      ? 'border-line-strong bg-surface-sunken'
                      : 'border-line bg-surface hover:bg-surface-sunken/50',
                  )}
                >
                  <RadioGroupItem id={`ob-profile-${id}`} value={id} className="mt-0.5" />
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

          <ToggleRow
            label="Send text messages too"
            description="Adds SMS to the later steps. Email always sends; you can fine-tune this in Settings."
            checked={smsEnabled}
            onCheckedChange={setSmsEnabled}
            disabled={!canManage}
          />
          <ToggleRow
            label="Start chasing automatically"
            description="Leave on to begin the moment a client's checklist goes out. Turn off to stay in control and send manually."
            checked={enabled}
            onCheckedChange={setEnabled}
            disabled={!canManage}
          />
        </div>

        <aside className="min-w-0">
          <div className="rounded-xl border border-line bg-surface-sunken/40 p-4">
            <CadencePreview
              settings={settings}
              timezone={firm.timezone}
              firmName={firm.branding.displayName || firm.name}
              slug={firm.slug}
              preparerName={preparerName}
            />
          </div>
        </aside>
      </div>

      <StepFooter
        onBack={onBack}
        onContinue={save}
        onSkip={onSkip}
        continueLoading={saving}
        continueLabel="Save & finish"
      />
    </StepCard>
  );
}

function DoneScreen({
  firm,
  onFinish,
  onReview,
}: {
  firm: Firm;
  onFinish: () => void;
  onReview: () => void;
}) {
  const progress = onboardingProgress(firm);
  return (
    <section aria-label="Setup complete" className="text-center sm:text-left">
      <span className="inline-flex size-11 items-center justify-center rounded-xl bg-stamp-wash text-stamp-ink">
        <PartyPopper className="size-5" />
      </span>
      <h2 className="display mt-4 text-2xl text-ink sm:text-3xl">Your firm is ready to chase.</h2>
      <p className="mt-2 max-w-prose text-pretty text-sm text-ink-muted">
        {progress.completed === progress.total
          ? 'Every step is done. Your clients are in, the checklist engine is primed, and your cadence is set.'
          : `You've finished ${progress.completed} of ${progress.total} steps — plenty to start. The rest is one click away whenever you want it.`}
      </p>
      <div className="mt-6 flex flex-col items-center gap-2 sm:flex-row">
        <Button variant="primary" onClick={onFinish}>
          Go to your dashboard
          <ArrowRight className="size-4" />
        </Button>
        <Button variant="ghost" onClick={onReview}>
          Review the steps
        </Button>
      </div>
    </section>
  );
}

function OnboardingSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <Skeleton className="h-9 w-72 max-w-full rounded" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full rounded" />
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-12">
        <div className="hidden space-y-2 lg:block">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded" />
          ))}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-8 w-56 rounded" />
          <Skeleton className="h-40 w-full rounded" />
        </div>
      </div>
    </div>
  );
}
