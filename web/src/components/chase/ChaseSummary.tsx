import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { Pause, Play } from 'lucide-react';
import { CHASE_PROFILES, paths, ROLE_RANK, type ChaseSettings, type FirmRole } from '@taxfax/shared';
import { db } from '@/lib/firebase';
import { Button, Switch, toast } from '@/components/ui';

function fmtHour(h: number): string {
  const hour = ((h % 24) + 24) % 24;
  const period = hour < 12 ? 'am' : 'pm';
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}${period}`;
}

interface ChaseSummaryProps {
  firmId: string;
  settings: ChaseSettings;
  timezone: string;
  role: FirmRole;
}

export function ChaseSummary({ firmId, settings, timezone, role }: ChaseSummaryProps) {
  const [busy, setBusy] = useState(false);
  const canControlFirm = ROLE_RANK[role] >= ROLE_RANK.admin;
  const profile = CHASE_PROFILES[settings.profile];
  const quiet = `${fmtHour(settings.quietHours.start)}–${fmtHour(settings.quietHours.end)}`;
  const days = settings.sendOnWeekends ? 'Every day' : 'Mon–Fri';
  const tzCity = timezone.split('/').pop()?.replace(/_/g, ' ') ?? timezone;

  async function setEnabled(next: boolean) {
    setBusy(true);
    try {
      await updateDoc(doc(db, paths.firm(firmId)), { 'chase.enabled': next });
      toast.success(next ? 'Chasing resumed firm-wide.' : 'All chasing paused firm-wide.');
    } catch {
      toast.error('Couldn’t change the firm setting. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-line px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <dl className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <Fact label="Cadence" value={profile.label} />
          <Fact label="Quiet hours" value={quiet} />
          <Fact label="Send days" value={days} />
          <Fact label="Client time" value={tzCity} />
          <Fact label="Escalates" value={`after step ${settings.escalateAfterStep}`} />
        </dl>

        {canControlFirm && (
          <label className="flex cursor-pointer items-center gap-2">
            <Switch checked={settings.enabled} onCheckedChange={setEnabled} disabled={busy} aria-label="Chasing enabled firm-wide" />
            <span className="text-2xs font-medium text-ink-muted">{settings.enabled ? 'Chasing on' : 'Chasing paused'}</span>
          </label>
        )}
      </div>

      {!settings.enabled && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-status-warn/25 bg-status-warn-wash px-3.5 py-2.5">
          <Pause className="size-4 shrink-0 text-status-warn" />
          <p className="flex-1 text-[13px] text-ink">
            <span className="font-medium">Chasing is paused for the whole firm.</span> No reminders will send until it's back on.
          </p>
          {canControlFirm && (
            <Button variant="secondary" size="sm" onClick={() => setEnabled(true)} loading={busy}>
              <Play /> Resume all
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="label-eyebrow text-ink-faint">{label}</dt>
      <dd className="text-[13px] font-medium text-ink">{value}</dd>
    </div>
  );
}
