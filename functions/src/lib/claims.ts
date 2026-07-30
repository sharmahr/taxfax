/**
 * Custom-claim synchronisation — the invariant the whole tenancy model rests
 * on: `request.auth.token.firms` must always equal the member docs. Any write
 * to a member doc re-runs this, and the callables that change membership call
 * it inline so the caller's next `getIdToken(true)` is already correct.
 */
import { paths, type FirmRole } from '@taxfax/shared';
import { authAdmin, db, FieldValue } from './admin.js';

/**
 * Rebuilds the `firms` claim for one user from every `members/{uid}` doc across
 * all firms, preserving any existing `portal` claim so a taxpayer↔staff overlap
 * can never drop portal access. Also bumps `users/{uid}.claimsUpdatedAt` so the
 * web client knows to force-refresh its token.
 */
export async function syncClaimsFor(uid: string): Promise<void> {
  const snap = await db.collectionGroup('members').where('uid', '==', uid).get();

  const firms: Record<string, FirmRole> = {};
  for (const doc of snap.docs) {
    const member = doc.data() as { firmId?: string; role?: FirmRole; status?: string };
    if (!member.firmId || !member.role || member.status === 'disabled') continue;
    firms[member.firmId] = member.role;
  }

  let existing: Record<string, unknown> = {};
  try {
    existing = (await authAdmin.getUser(uid)).customClaims ?? {};
  } catch {
    // No auth user (e.g. a member row seeded ahead of first sign-in) — nothing
    // to attach claims to yet; the users doc below still records intent.
  }

  const next: Record<string, unknown> = { firms };
  if (existing.portal) next.portal = existing.portal;

  await authAdmin.setCustomUserClaims(uid, next);

  await db.doc(paths.user(uid)).set(
    { uid, firmIds: Object.keys(firms), claimsUpdatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}
