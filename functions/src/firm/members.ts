import { randomBytes } from 'node:crypto';
import { onCall } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import type { WithFieldValue } from 'firebase-admin/firestore';
import {
  paths,
  ROLE_LABEL,
  ROLE_RANK,
  type Firm,
  type FirmMember,
  type FirmRole,
  type Invite,
  type UserIndex,
} from '@taxfax/shared';
import { db, FieldValue, Timestamp } from '../lib/admin.js';
import { requireAuth, requireFirmRole } from '../lib/guards.js';
import { already, conflict, denied, exhausted, invalid, notFound } from '../lib/errors.js';
import { syncClaimsFor } from '../lib/claims.js';
import { logActivity } from '../lib/activity.js';
import { callableOptions, triggerOptions } from '../lib/options.js';
import { memberInviteEmail } from '../lib/mail.js';
import { cleanName, normEmail } from '../lib/validate.js';
import { avatarColor, resolveOrigin, tsMillis } from './util.js';

const INVITE_TTL_DAYS = 14;

function asRole(value: unknown): FirmRole | null {
  return value === 'owner' || value === 'admin' || value === 'preparer' || value === 'viewer'
    ? value
    : null;
}

function callerName(token: { name?: unknown; email?: unknown }, fallback: string): string {
  return (
    cleanName(token.name, 1, 120) ??
    (typeof token.email === 'string' ? token.email.split('@')[0]! : fallback)
  );
}

// ── inviteMember ────────────────────────────────────────────────────────────
export const inviteMember = onCall(callableOptions, async (req) => {
  const data = (req.data ?? {}) as Record<string, unknown>;
  const firmId = typeof data.firmId === 'string' ? data.firmId : '';
  if (!firmId) throw invalid('Missing the workspace this invite is for.');

  const caller = requireFirmRole(req, firmId, 'admin');
  const email = normEmail(data.email);
  if (!email) throw invalid("That doesn't look like a valid email address.");

  const role = asRole(data.role);
  if (!role) throw invalid('Pick a role: Admin, Preparer, or Viewer.');
  if (ROLE_RANK[role] > ROLE_RANK[caller.role]) {
    throw denied('You can only invite people at your own level or below.');
  }

  const firmSnap = await db.doc(paths.firm(firmId)).get();
  if (!firmSnap.exists) throw notFound('That workspace no longer exists.');
  const firm = firmSnap.data() as Firm;

  const alreadyMember = await db
    .collection(paths.members(firmId))
    .where('email', '==', email)
    .limit(1)
    .get();
  if (!alreadyMember.empty) {
    throw already('That person is already on your team.');
  }

  const [memberCount, pending] = await Promise.all([
    db.collection(paths.members(firmId)).count().get(),
    db.collection('invites').where('firmId', '==', firmId).where('status', '==', 'pending').get(),
  ]);
  const inviterName = callerName(caller.token, 'A teammate');
  const origin = resolveOrigin(req, data.origin);

  const existing = pending.docs.find((d) => (d.data() as Invite).email === email);
  const token = existing ? existing.id : randomBytes(24).toString('base64url');

  if (!existing) {
    const used = memberCount.data().count + pending.size;
    if (used >= firm.seats) {
      throw exhausted(
        `You've used all ${firm.seats} seats on the ${firm.plan} plan. Upgrade to add more of your team.`,
      );
    }
  }

  const invite: WithFieldValue<Invite> = {
    token,
    firmId,
    firmName: firm.name,
    email,
    role,
    invitedBy: caller.uid,
    invitedByName: inviterName,
    createdAt: existing ? (existing.data() as Invite).createdAt : FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromDate(new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000)),
    status: 'pending',
  };
  await db.doc(paths.invite(token)).set(invite, { merge: true });

  const copy = memberInviteEmail({
    firmName: firm.branding.displayName || firm.name,
    inviterName,
    roleLabel: ROLE_LABEL[role],
    acceptUrl: `${origin}/invite/${token}`,
    expiresInDays: INVITE_TTL_DAYS,
  });
  await db.collection(paths.mail()).add({
    to: [email],
    message: { subject: copy.subject, text: copy.text, html: copy.html },
  });

  await logActivity(firmId, {
    type: 'member_invited',
    summary: `${inviterName} invited ${email} to join as ${ROLE_LABEL[role]}.`,
    actor: { uid: caller.uid, name: inviterName, kind: 'staff' },
    meta: { email, role },
  });

  return { token, email, role, resent: Boolean(existing) };
});

// ── acceptInvite ────────────────────────────────────────────────────────────
export const acceptInvite = onCall(callableOptions, async (req) => {
  const { uid, token } = requireAuth(req);
  const data = (req.data ?? {}) as Record<string, unknown>;
  const inviteToken = typeof data.token === 'string' ? data.token : '';
  if (!inviteToken) throw invalid('That invite link is missing its code.');

  const callerEmail = normEmail(token.email);
  if (!callerEmail || token.email_verified !== true) {
    throw denied('Verify your email address first, then open the invite link again.');
  }

  const result = await db.runTransaction(async (tx) => {
    const inviteRef = db.doc(paths.invite(inviteToken));
    const inviteSnap = await tx.get(inviteRef);
    if (!inviteSnap.exists) {
      throw notFound('That invite link is invalid. Ask for a fresh one.');
    }
    const invite = inviteSnap.data() as Invite;

    if (invite.status === 'accepted') {
      throw already('That invite has already been used. Ask for a new one if you still need access.');
    }
    if (invite.status === 'revoked') {
      throw denied('That invite was revoked. Ask an admin to send you a new one.');
    }
    if (invite.status !== 'pending' || tsMillis(invite.expiresAt) <= Date.now()) {
      throw conflict('That invite has expired. Ask an admin to send you a new one.');
    }
    if (normEmail(invite.email) !== callerEmail) {
      throw denied('This invite was sent to a different email address. Sign in with that address to accept it.');
    }

    const firmRef = db.doc(paths.firm(invite.firmId));
    const firmSnap = await tx.get(firmRef);
    if (!firmSnap.exists) throw notFound('That workspace no longer exists.');
    const firm = firmSnap.data() as Firm;

    const memberRef = db.doc(paths.member(invite.firmId, uid));
    const memberSnap = await tx.get(memberRef);
    const userRef = db.doc(paths.user(uid));
    const userSnap = await tx.get(userRef);

    const acceptName =
      cleanName(data.name, 1, 120) ?? callerName(token, callerEmail.split('@')[0]!);

    if (memberSnap.exists) {
      // Already a member — just close out the invite so the link can't linger.
      tx.set(inviteRef, { status: 'accepted', acceptedAt: FieldValue.serverTimestamp() }, { merge: true });
      return { firmId: invite.firmId, role: (memberSnap.data() as FirmMember).role, firmName: firm.name, name: acceptName };
    }

    const membersSnap = await tx.get(db.collection(paths.members(invite.firmId)));
    if (membersSnap.size >= firm.seats) {
      throw exhausted('This workspace is out of seats. Ask an owner to upgrade the plan, then try again.');
    }

    const member: WithFieldValue<FirmMember> = {
      uid,
      firmId: invite.firmId,
      email: callerEmail,
      name: acceptName,
      role: invite.role,
      avatarColor: avatarColor(uid),
      invitedBy: invite.invitedBy,
      joinedAt: FieldValue.serverTimestamp(),
      status: 'active',
    };
    tx.set(memberRef, member);
    tx.set(inviteRef, { status: 'accepted', acceptedAt: FieldValue.serverTimestamp() }, { merge: true });

    const existingUser = userSnap.exists ? (userSnap.data() as UserIndex) : undefined;
    const userIndex: WithFieldValue<Partial<UserIndex>> = {
      uid,
      email: callerEmail,
      name: existingUser?.name ?? acceptName,
      firmIds: FieldValue.arrayUnion(invite.firmId),
      defaultFirmId: existingUser?.defaultFirmId ?? invite.firmId,
    };
    tx.set(userRef, userIndex, { merge: true });

    return { firmId: invite.firmId, role: invite.role, firmName: firm.name, name: acceptName };
  });

  await syncClaimsFor(uid);
  await logActivity(result.firmId, {
    type: 'member_joined',
    summary: `${result.name} joined ${result.firmName} as ${ROLE_LABEL[result.role]}.`,
    actor: { uid, name: result.name, kind: 'staff' },
  });

  return result;
});

// ── revokeInvite ────────────────────────────────────────────────────────────
export const revokeInvite = onCall(callableOptions, async (req) => {
  const data = (req.data ?? {}) as Record<string, unknown>;
  const firmId = typeof data.firmId === 'string' ? data.firmId : '';
  const token = typeof data.token === 'string' ? data.token : '';
  if (!firmId || !token) throw invalid('Missing the invite to revoke.');

  requireFirmRole(req, firmId, 'admin');

  const ref = db.doc(paths.invite(token));
  const snap = await ref.get();
  if (!snap.exists) throw notFound('That invite no longer exists.');
  const invite = snap.data() as Invite;
  if (invite.firmId !== firmId) throw denied('That invite belongs to another workspace.');
  if (invite.status === 'revoked') return { ok: true };
  if (invite.status === 'accepted') {
    throw conflict('That invite was already accepted — remove the member instead.');
  }
  await ref.set({ status: 'revoked' }, { merge: true });
  return { ok: true };
});

// ── updateMemberRole ────────────────────────────────────────────────────────
export const updateMemberRole = onCall(callableOptions, async (req) => {
  const data = (req.data ?? {}) as Record<string, unknown>;
  const firmId = typeof data.firmId === 'string' ? data.firmId : '';
  const targetUid = typeof data.uid === 'string' ? data.uid : '';
  if (!firmId || !targetUid) throw invalid('Missing the member to update.');

  const caller = requireFirmRole(req, firmId, 'admin');
  const role = asRole(data.role);
  if (!role) throw invalid('Pick a role: Owner, Admin, Preparer, or Viewer.');
  if (ROLE_RANK[role] > ROLE_RANK[caller.role]) {
    throw denied('You can only grant a role at your own level or below.');
  }

  await db.runTransaction(async (tx) => {
    const memberRef = db.doc(paths.member(firmId, targetUid));
    const memberSnap = await tx.get(memberRef);
    if (!memberSnap.exists) throw notFound("That person isn't on your team.");
    const member = memberSnap.data() as FirmMember;

    if (ROLE_RANK[caller.role] < ROLE_RANK[member.role]) {
      throw denied("You can't change the role of someone who outranks you.");
    }
    if (member.role === role) return;

    if (member.role === 'owner' && role !== 'owner') {
      const owners = await tx.get(db.collection(paths.members(firmId)).where('role', '==', 'owner'));
      if (owners.size <= 1) {
        throw conflict("You can't demote the last owner. Make someone else an owner first.");
      }
    }
    tx.set(memberRef, { role }, { merge: true });
  });

  await syncClaimsFor(targetUid);
  return { ok: true, role };
});

// ── removeMember ────────────────────────────────────────────────────────────
export const removeMember = onCall(callableOptions, async (req) => {
  const data = (req.data ?? {}) as Record<string, unknown>;
  const firmId = typeof data.firmId === 'string' ? data.firmId : '';
  const targetUid = typeof data.uid === 'string' ? data.uid : '';
  if (!firmId || !targetUid) throw invalid('Missing the member to remove.');

  const caller = requireFirmRole(req, firmId, 'admin');

  const removed = await db.runTransaction(async (tx) => {
    const memberRef = db.doc(paths.member(firmId, targetUid));
    const memberSnap = await tx.get(memberRef);
    if (!memberSnap.exists) return false;
    const member = memberSnap.data() as FirmMember;

    if (ROLE_RANK[caller.role] < ROLE_RANK[member.role]) {
      throw denied("You can't remove someone who outranks you.");
    }
    if (member.role === 'owner') {
      const owners = await tx.get(db.collection(paths.members(firmId)).where('role', '==', 'owner'));
      if (owners.size <= 1) {
        throw conflict("You can't remove the last owner. Make someone else an owner first.");
      }
    }

    const userRef = db.doc(paths.user(targetUid));
    const userSnap = await tx.get(userRef);

    tx.delete(memberRef);

    const patch: Record<string, unknown> = { firmIds: FieldValue.arrayRemove(firmId) };
    if (userSnap.exists && (userSnap.data() as UserIndex).defaultFirmId === firmId) {
      patch.defaultFirmId = FieldValue.delete();
    }
    tx.set(userRef, patch, { merge: true });
    return true;
  });

  if (removed) await syncClaimsFor(targetUid);
  return { ok: true };
});

// ── onMemberWritten ─────────────────────────────────────────────────────────
// The safety net: any path that changes a member doc — including a direct admin
// edit — re-derives that user's claims so members and claims can't drift.
export const onMemberWritten = onDocumentWritten(
  { ...triggerOptions, document: 'firms/{firmId}/members/{uid}' },
  async (event) => {
    await syncClaimsFor(event.params.uid);
  },
);
