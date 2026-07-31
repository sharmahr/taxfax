import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { paths, type FirmRole } from '@taxfax/shared';
import { db, functions } from '@/lib/firebase';
import type { ImportRowPayload } from '@/components/onboarding/csv';

/**
 * The write surface for firm settings and onboarding. Firm profile, branding,
 * chase and onboarding state are edited directly through the client SDK — the
 * security rules already let an admin change everything except billing — while
 * anything that must not drift from custom claims (membership) goes through the
 * firm callables. One home so settings and onboarding share exactly one path.
 */

/** Direct firm-document patch. Callers pass full sub-objects or dot-path keys. */
export function updateFirm(firmId: string, patch: Record<string, unknown>): Promise<void> {
  return updateDoc(doc(db, paths.firm(firmId)), patch);
}

export function markOnboardingStep(firmId: string, stepId: string): Promise<void> {
  return updateDoc(doc(db, paths.firm(firmId)), {
    'onboarding.completedSteps': arrayUnion(stepId),
  });
}

export function setOnboardingDismissed(firmId: string, dismissed: boolean): Promise<void> {
  return updateDoc(doc(db, paths.firm(firmId)), { 'onboarding.dismissed': dismissed });
}

// ── Member callables ─────────────────────────────────────────────────────────
export interface InviteResult {
  token: string;
  email: string;
  role: FirmRole;
  resent: boolean;
}

export async function inviteMember(input: {
  firmId: string;
  email: string;
  role: FirmRole;
}): Promise<InviteResult> {
  const call = httpsCallable<typeof input & { origin: string }, InviteResult>(functions, 'inviteMember');
  const res = await call({ ...input, origin: window.location.origin });
  return res.data;
}

export async function updateMemberRole(input: {
  firmId: string;
  uid: string;
  role: FirmRole;
}): Promise<{ ok: boolean; role: FirmRole }> {
  const call = httpsCallable<typeof input, { ok: boolean; role: FirmRole }>(functions, 'updateMemberRole');
  return (await call(input)).data;
}

export async function removeMember(input: { firmId: string; uid: string }): Promise<{ ok: boolean }> {
  const call = httpsCallable<typeof input, { ok: boolean }>(functions, 'removeMember');
  return (await call(input)).data;
}

export async function revokeInvite(input: { firmId: string; token: string }): Promise<{ ok: boolean }> {
  const call = httpsCallable<typeof input, { ok: boolean }>(functions, 'revokeInvite');
  return (await call(input)).data;
}

// ── Client import ────────────────────────────────────────────────────────────
export interface ImportResult {
  created: number;
  skipped: number;
  errors: { row: number; reason: string }[];
}

export async function importClients(input: {
  firmId: string;
  taxYear?: number;
  rows: ImportRowPayload[];
  defaultAssignedTo?: string;
}): Promise<ImportResult> {
  const call = httpsCallable<typeof input, ImportResult>(functions, 'importClients');
  return (await call(input)).data;
}
