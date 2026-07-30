import { onCall } from 'firebase-functions/v2/https';
import type { WithFieldValue } from 'firebase-admin/firestore';
import {
  DEFAULT_CHASE_SETTINGS,
  paths,
  type Firm,
  type FirmMember,
  type UserIndex,
} from '@taxfax/shared';
import { db, FieldValue, Timestamp } from '../lib/admin.js';
import { requireAuth } from '../lib/guards.js';
import { already, invalid } from '../lib/errors.js';
import { syncClaimsFor } from '../lib/claims.js';
import { logActivity } from '../lib/activity.js';
import { callableOptions } from '../lib/options.js';
import { cleanName, normEmail, optionalStr } from '../lib/validate.js';
import { avatarColor } from './util.js';

const TRIAL_DAYS = 30;
const TRIAL_SEATS = 5;
const DEFAULT_TIMEZONE = 'America/New_York';
const DEFAULT_ACCENT = '#4F46E5';

function slugBase(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return slug || 'firm';
}

/** Jan–Sep: last year's return is the live season. Oct+: the upcoming one. */
function defaultTaxYear(): number {
  const now = new Date();
  const year = now.getUTCFullYear();
  return now.getUTCMonth() >= 9 ? year : year - 1;
}

export const createFirm = onCall(callableOptions, async (req) => {
  const { uid, token } = requireAuth(req);
  const data = (req.data ?? {}) as Record<string, unknown>;

  const name = cleanName(data.name, 2, 100);
  if (!name) {
    throw invalid('Give your firm a name between 2 and 100 characters.');
  }
  const ownerEmail = normEmail(token.email);
  if (!ownerEmail) {
    throw invalid("We couldn't read your email address. Sign out, sign back in, and try again.");
  }
  const ownerName =
    cleanName((token.name as string | undefined) ?? data.ownerName, 1, 120) ??
    ownerEmail.split('@')[0]!;

  const timezone = optionalStr(data.timezone) ?? DEFAULT_TIMEZONE;
  const displayName = cleanName(data.displayName, 1, 100) ?? name;
  const accent = optionalStr(data.accent) ?? DEFAULT_ACCENT;
  const replyToEmail = normEmail(data.replyToEmail) ?? ownerEmail;
  const supportPhone = optionalStr(data.supportPhone);
  const taxYear = Number.isInteger(data.taxYear) ? (data.taxYear as number) : defaultTaxYear();

  const firmRef = db.collection('firms').doc();
  const memberRef = db.doc(paths.member(firmRef.id, uid));
  const userRef = db.doc(paths.user(uid));
  const base = slugBase(name);
  const signature = `— ${ownerName} at ${displayName}`;

  const slug = await db.runTransaction(async (tx) => {
    const clash = await tx.get(db.collection('firms').where('slug', '==', base).limit(1));
    const existingUser = await tx.get(userRef);

    let chosen = base;
    if (!clash.empty) {
      const owner = clash.docs[0]!.data() as Firm;
      if (owner.createdBy === uid) {
        throw already(`You already have a workspace called "${owner.name}".`);
      }
      chosen = `${base}-${firmRef.id.slice(0, 6).toLowerCase()}`;
    }

    const firm: WithFieldValue<Firm> = {
      id: firmRef.id,
      name,
      slug: chosen,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: uid,
      taxYear,
      timezone,
      branding: { displayName, accent, replyToEmail, supportPhone },
      chase: { ...DEFAULT_CHASE_SETTINGS, signature },
      seats: TRIAL_SEATS,
      plan: 'trial',
      trialEndsAt: Timestamp.fromDate(new Date(Date.now() + TRIAL_DAYS * 86_400_000)),
      onboarding: { completedSteps: [], dismissed: false },
    };

    const member: WithFieldValue<FirmMember> = {
      uid,
      firmId: firmRef.id,
      email: ownerEmail,
      name: ownerName,
      role: 'owner',
      avatarColor: avatarColor(uid),
      joinedAt: FieldValue.serverTimestamp(),
      status: 'active',
    };

    const existing = existingUser.exists ? (existingUser.data() as UserIndex) : undefined;
    const userIndex: WithFieldValue<Partial<UserIndex>> = {
      uid,
      email: ownerEmail,
      name: existing?.name ?? ownerName,
      firmIds: FieldValue.arrayUnion(firmRef.id),
      defaultFirmId: existing?.defaultFirmId ?? firmRef.id,
    };

    tx.set(firmRef, firm);
    tx.set(memberRef, member);
    tx.set(userRef, userIndex, { merge: true });
    return chosen;
  });

  await syncClaimsFor(uid);
  await logActivity(firmRef.id, {
    type: 'member_joined',
    summary: `${ownerName} created ${name}.`,
    actor: { uid, name: ownerName, kind: 'staff' },
  });

  return { firmId: firmRef.id, slug, taxYear, role: 'owner' as const };
});
