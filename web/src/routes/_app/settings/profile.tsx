import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ROLE_RANK } from '@taxfax/shared';
import { useAuth } from '@/lib/auth';
import { firebaseErrorMessage } from '@/lib/errors';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import { SettingsHeader, SettingsSection, FieldGrid } from '@/components/settings/layout';
import { SaveBar } from '@/components/settings/SaveBar';
import { useDraft } from '@/components/settings/useDraft';
import { updateFirm } from '@/components/settings/api';
import { normEmail } from '@/components/onboarding/csv';

export const Route = createFileRoute('/_app/settings/profile')({
  component: FirmProfilePage,
});

const TIMEZONES: { value: string; label: string }[] = [
  { value: 'America/New_York', label: 'Eastern — New York' },
  { value: 'America/Chicago', label: 'Central — Chicago' },
  { value: 'America/Denver', label: 'Mountain — Denver' },
  { value: 'America/Phoenix', label: 'Mountain (no DST) — Phoenix' },
  { value: 'America/Los_Angeles', label: 'Pacific — Los Angeles' },
  { value: 'America/Anchorage', label: 'Alaska — Anchorage' },
  { value: 'Pacific/Honolulu', label: 'Hawaii — Honolulu' },
];

const HEX_RE = /^#([0-9a-f]{6})$/i;

interface ProfileDraft {
  name: string;
  displayName: string;
  replyToEmail: string;
  supportPhone: string;
  accent: string;
  timezone: string;
  taxYear: number;
  deadline: string; // MM-DD
}

/** MM-DD ↔ the YYYY-MM-DD a native date input wants, pinned to the filing year. */
function toDateInput(deadline: string, filingYear: number): string {
  return /^\d{2}-\d{2}$/.test(deadline) ? `${filingYear}-${deadline}` : `${filingYear}-04-15`;
}
function fromDateInput(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value.slice(5) : '04-15';
}

function FirmProfilePage() {
  const { activeFirm } = useAuth();
  const firm = activeFirm?.firm;
  const canEdit = activeFirm ? ROLE_RANK[activeFirm.role] >= ROLE_RANK.admin : false;

  if (!firm) return <ProfileSkeleton />;

  return (
    <ProfileForm
      key={firm.id}
      firmId={firm.id}
      canEdit={canEdit}
      initial={{
        name: firm.name,
        displayName: firm.branding.displayName ?? firm.name,
        replyToEmail: firm.branding.replyToEmail ?? '',
        supportPhone: firm.branding.supportPhone ?? '',
        accent: HEX_RE.test(firm.branding.accent ?? '') ? firm.branding.accent : '#b23c1e',
        timezone: firm.timezone,
        taxYear: firm.taxYear,
        deadline: firm.chase.deadline,
      }}
      logoPath={firm.branding.logoPath}
    />
  );
}

function ProfileForm({
  firmId,
  canEdit,
  initial,
  logoPath,
}: {
  firmId: string;
  canEdit: boolean;
  initial: ProfileDraft;
  logoPath?: string;
}) {
  const { value, set, dirty, reset, commit } = useDraft(initial);
  const [saving, setSaving] = useState(false);

  const nameError = value.name.trim().length === 0 ? 'Your firm needs a name.' : undefined;
  const emailError =
    value.replyToEmail.trim() && !normEmail(value.replyToEmail)
      ? "That doesn't look like a valid email address."
      : undefined;
  const accentError = HEX_RE.test(value.accent) ? undefined : 'Use a 6-digit hex color, like #b23c1e.';
  const blocked = Boolean(nameError || emailError || accentError);

  const filingYear = value.taxYear + 1;

  async function save() {
    if (blocked) return;
    setSaving(true);
    try {
      const supportPhone = value.supportPhone.trim();
      await updateFirm(firmId, {
        name: value.name.trim(),
        timezone: value.timezone,
        taxYear: value.taxYear,
        'chase.deadline': value.deadline,
        branding: {
          displayName: value.displayName.trim() || value.name.trim(),
          accent: value.accent.toLowerCase(),
          replyToEmail: value.replyToEmail.trim(),
          ...(logoPath ? { logoPath } : {}),
          ...(supportPhone ? { supportPhone } : {}),
        },
      });
      commit();
      toast.success('Firm profile saved.');
    } catch (err) {
      toast.error(firebaseErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const disabled = !canEdit;

  return (
    <div>
      <SettingsHeader
        title="Firm profile"
        description="How your practice appears to clients — on the portal and at the top of every reminder you send."
      />

      {!canEdit ? (
        <p className="mt-6 rounded-lg border border-line bg-surface-sunken px-3.5 py-2.5 text-2xs text-ink-muted">
          Only owners and admins can change firm settings. You can review what's set here.
        </p>
      ) : null}

      <div className="mt-8 space-y-8">
        <SettingsSection
          title="Identity"
          description="The name clients recognize and the address their replies reach."
        >
          <Field label="Firm name" error={nameError} required>
            <Input
              value={value.name}
              disabled={disabled}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Whitfield & Rowe CPAs"
              autoComplete="organization"
            />
          </Field>

          <Field
            label="Name clients see"
            hint="Shown on the portal and as the sender name. Usually the same as your firm name."
          >
            <Input
              value={value.displayName}
              disabled={disabled}
              onChange={(e) => set('displayName', e.target.value)}
              placeholder="Whitfield & Rowe"
            />
          </Field>

          <FieldGrid>
            <Field label="Reply-to email" error={emailError} hint="Where client replies land.">
              <Input
                type="email"
                value={value.replyToEmail}
                disabled={disabled}
                onChange={(e) => set('replyToEmail', e.target.value)}
                placeholder="team@whitfieldrowe.com"
                autoComplete="email"
              />
            </Field>
            <Field label="Support phone" hint="Optional. Appears in the portal footer.">
              <Input
                type="tel"
                value={value.supportPhone}
                disabled={disabled}
                onChange={(e) => set('supportPhone', e.target.value)}
                placeholder="(415) 555-0142"
                autoComplete="tel"
              />
            </Field>
          </FieldGrid>
        </SettingsSection>

        <SettingsSection
          title="Client-facing brand"
          description="The accent color on your portal and email header. This is your firm's color, not the app's."
        >
          <Field label="Brand color" error={accentError}>
            <div className="flex items-center gap-3">
              <input
                type="color"
                aria-label="Brand color swatch"
                value={HEX_RE.test(value.accent) ? value.accent : '#b23c1e'}
                disabled={disabled}
                onChange={(e) => set('accent', e.target.value)}
                className="size-9 shrink-0 cursor-pointer rounded-md border border-line-strong bg-surface disabled:cursor-not-allowed"
              />
              <Input
                value={value.accent}
                disabled={disabled}
                onChange={(e) => set('accent', e.target.value)}
                className="ticket w-32 uppercase"
                spellCheck={false}
                aria-label="Brand color hex value"
              />
              <span
                aria-hidden
                className="hidden h-9 flex-1 items-center rounded-md px-3 text-xs font-medium text-white sm:flex"
                style={{ backgroundColor: HEX_RE.test(value.accent) ? value.accent : '#b23c1e' }}
              >
                Your firm, on every message
              </span>
            </div>
          </Field>
        </SettingsSection>

        <SettingsSection
          title="Season & deadline"
          description="The filing year you're collecting for and the deadline the chase counts down to."
        >
          <FieldGrid>
            <Field label="Filing season" hint="The return year you're gathering documents for.">
              <Select
                value={String(value.taxYear)}
                disabled={disabled}
                onValueChange={(v) => set('taxYear', Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[value.taxYear - 1, value.taxYear, value.taxYear + 1].map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y} tax year
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Timezone" hint="Chase messages respect quiet hours in this zone.">
              <Select
                value={value.timezone}
                disabled={disabled}
                onValueChange={(v) => set('timezone', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(TIMEZONES.some((t) => t.value === value.timezone)
                    ? TIMEZONES
                    : [{ value: value.timezone, label: value.timezone }, ...TIMEZONES]
                  ).map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGrid>

          <Field
            label="Filing deadline"
            hint="We use the month and day; the year follows the season. The chase tightens as it nears."
          >
            <Input
              type="date"
              value={toDateInput(value.deadline, filingYear)}
              disabled={disabled}
              onChange={(e) => set('deadline', fromDateInput(e.target.value))}
              className="w-48"
            />
          </Field>
        </SettingsSection>
      </div>

      {canEdit ? (
        <SaveBar dirty={dirty} saving={saving} onSave={save} onDiscard={reset} />
      ) : null}
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div>
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <div className="mt-8 space-y-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="grid grid-cols-1 gap-x-10 gap-y-5 border-t border-line pt-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-40" />
            </div>
            <div className="space-y-5">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
