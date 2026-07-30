import { onCall } from 'firebase-functions/v2/https';
import type { WithFieldValue } from 'firebase-admin/firestore';
import { paths, type Client, type Firm, type PortalGrant } from '@taxfax/shared';
import { authAdmin, db, FieldValue } from '../lib/admin.js';
import { requireAuth, requireFirmRole } from '../lib/guards.js';
import { denied, invalid, notFound } from '../lib/errors.js';
import { logActivity } from '../lib/activity.js';
import { callableOptions } from '../lib/options.js';
import { cleanName, normEmail } from '../lib/validate.js';
import { firstNameOf, resolveOrigin, tsMillis } from './util.js';

// ── sendPortalInvite ────────────────────────────────────────────────────────
// Issues the taxpayer's access as a Firebase email-link sign-in. We email the
// link rather than return it: the link is a sign-in credential, so only the
// taxpayer's inbox should ever hold it.
export const sendPortalInvite = onCall(callableOptions, async (req) => {
  const data = (req.data ?? {}) as Record<string, unknown>;
  const firmId = typeof data.firmId === 'string' ? data.firmId : '';
  const clientId = typeof data.clientId === 'string' ? data.clientId : '';
  if (!firmId || !clientId) throw invalid('Missing the client to invite.');

  const caller = requireFirmRole(req, firmId, 'preparer');

  const [firmSnap, clientSnap] = await Promise.all([
    db.doc(paths.firm(firmId)).get(),
    db.doc(paths.client(firmId, clientId)).get(),
  ]);
  if (!clientSnap.exists) throw notFound('That client no longer exists.');
  const client = clientSnap.data() as Client;
  const firm = firmSnap.data() as Firm | undefined;

  const email = normEmail(client.primaryContact?.email);
  if (!email) {
    throw invalid(`Add an email for ${client.displayName} before sending their portal link.`);
  }

  const origin = resolveOrigin(req, data.origin);
  const link = await authAdmin.generateSignInWithEmailLink(email, {
    url: `${origin}/portal/enter`,
    handleCodeInApp: true,
  });

  const brand = firm?.branding.displayName || firm?.name || 'your accountant';
  const preparerName = cleanName(caller.token.name, 1, 120) ?? brand;
  const greeting = firstNameOf(client.primaryContact?.name || client.displayName);

  const subject = `Your secure document portal for ${brand}`;
  const text = `Hi ${greeting},

${preparerName} at ${brand} has set up a secure portal for your tax documents. No password to remember — just open this link to get in:

${link}

Once you're in you'll see exactly what we need and can upload straight from your phone. Photos are fine; we straighten and rename everything for you.

This link is just for you, so please don't forward it.

— ${brand}`;
  const html = `<p>Hi ${greeting},</p>
<p><strong>${preparerName}</strong> at <strong>${brand}</strong> has set up a secure portal for your tax documents. No password to remember — just open this link to get in:</p>
<p><a href="${link}">Open my document portal</a></p>
<p>Once you're in you'll see exactly what we need and can upload straight from your phone. Photos are fine; we straighten and rename everything for you.</p>
<p style="color:#6b7280;font-size:13px">This link is just for you, so please don't forward it.</p>
<p>— ${brand}</p>`;

  await db.collection(paths.mail()).add({ to: [email], message: { subject, text, html } });

  return { ok: true, email };
});

// ── claimPortalAccess ───────────────────────────────────────────────────────
// SECURITY: chosen over a `beforeUserSignedIn` blocking function on purpose.
//  1. Least blast radius — a blocking function runs on *every* sign-in incl.
//     staff, and a throw there locks the whole firm out during tax season. This
//     only affects the taxpayer who calls it.
//  2. Clean claim separation — it only ever writes the `portal` claim (never
//     `firms`), so a taxpayer can never obtain firm access; the members trigger
//     stays the single writer of `firms`.
//  3. Same posture in the emulator and prod — blocking functions need Identity
//     Platform enabled, which can't be assumed; this needs nothing extra.
// Authorization = a Firebase-verified email (proven by the email-link sign-in)
// that a firm has on file as a client contact. Ownership of the inbox is the
// credential, so no separate token is needed.
export const claimPortalAccess = onCall(callableOptions, async (req) => {
  const { uid, token } = requireAuth(req);
  const email = normEmail(token.email);
  if (!email || token.email_verified !== true) {
    throw denied('Open the secure link we emailed you — that link is what proves it is really you.');
  }

  const [primary, secondary] = await Promise.all([
    db.collectionGroup('clients').where('primaryContact.email', '==', email).get(),
    db.collectionGroup('clients').where('secondaryContact.email', '==', email).get(),
  ]);

  const matches = new Map<string, { firmId: string; clientId: string; client: Client }>();
  for (const doc of [...primary.docs, ...secondary.docs]) {
    const client = doc.data() as Client;
    if (client.archivedAt) continue;
    const clientFirmId = doc.ref.parent.parent?.id;
    if (!clientFirmId) continue;
    matches.set(doc.ref.path, { firmId: clientFirmId, clientId: doc.id, client });
  }

  if (matches.size === 0) {
    throw notFound(
      `We couldn't find a tax file for ${email}. Ask your accountant to send your portal invite.`,
    );
  }

  const list = [...matches.values()];
  const wantFirm = typeof req.data?.firmId === 'string' ? req.data.firmId : undefined;
  const wantClient = typeof req.data?.clientId === 'string' ? req.data.clientId : undefined;
  const target =
    list.find((m) => m.firmId === wantFirm && m.clientId === wantClient) ??
    list.sort((a, b) => tsMillis(b.client.updatedAt) - tsMillis(a.client.updatedAt))[0]!;

  const existingClaims = (await authAdmin.getUser(uid)).customClaims ?? {};
  await authAdmin.setCustomUserClaims(uid, {
    ...existingClaims,
    portal: { firmId: target.firmId, clientId: target.clientId },
  });

  const grantRef = db.doc(paths.portalGrant(uid));
  const grantSnap = await grantRef.get();
  const isFirstGrant = !grantSnap.exists;
  const grant: WithFieldValue<PortalGrant> = {
    uid,
    firmId: target.firmId,
    clientId: target.clientId,
    email,
    createdAt: isFirstGrant ? FieldValue.serverTimestamp() : (grantSnap.data() as PortalGrant).createdAt,
    lastSeenAt: FieldValue.serverTimestamp(),
  };
  await grantRef.set(grant, { merge: true });

  const userIndex: Record<string, unknown> = {
    uid,
    email,
    name: cleanName(token.name, 1, 120) ?? email.split('@')[0]!,
    portalAccess: FieldValue.arrayUnion({ firmId: target.firmId, clientId: target.clientId }),
    claimsUpdatedAt: FieldValue.serverTimestamp(),
  };
  await db.doc(paths.user(uid)).set(userIndex, { merge: true });

  const firmSnap = await db.doc(paths.firm(target.firmId)).get();
  const firm = firmSnap.data() as Firm | undefined;

  if (isFirstGrant) {
    await logActivity(target.firmId, {
      type: 'client_viewed_portal',
      summary: `${target.client.displayName} activated their document portal.`,
      actor: { name: target.client.displayName, kind: 'client' },
      clientId: target.clientId,
    });
  }

  return {
    firmId: target.firmId,
    clientId: target.clientId,
    firmName: firm?.branding.displayName || firm?.name || '',
    matches: list.length,
  };
});
