import { onCall } from 'firebase-functions/v2/https';
import type { WithFieldValue } from 'firebase-admin/firestore';
import {
  paths,
  type Client,
  type DocRequest,
  type DocumentState,
  type Firm,
  type PortalGrant,
  type RequestStatus,
  type StoredDocument,
} from '@taxfax/shared';
import { authAdmin, db, FieldValue } from '../lib/admin.js';
import { portalClaim, requireAuth, requireFirmRole, requirePortal } from '../lib/guards.js';
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
    // Carry the address in the continue URL so the taxpayer never re-types it.
    // Firebase requires the email to complete an email-link sign-in; without it
    // the portal has to prompt, which turns a one-tap entry into a form.
    url: `${origin}/portal/enter?email=${encodeURIComponent(email)}`,
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

/**
 * A taxpayer withdrawing a document they just sent by mistake — the wrong page,
 * someone else's W-2, a photo of the kitchen table.
 *
 * Without this they have to telephone the firm, which is exactly the friction
 * this product exists to remove. It is deliberately not a delete: the Storage
 * object is immutable by design and stays where it is, so the firm keeps a
 * complete record of what arrived and when. Only the document's state changes,
 * and the request it was satisfying reopens.
 *
 * Bounded by a grace window. Once a preparer has accepted a document it is part
 * of the return's working papers and the taxpayer can no longer pull it back on
 * their own — at that point the firm has already acted on it.
 */
const RETRACT_WINDOW_MS = 24 * 60 * 60 * 1000;

export const retractDocument = onCall(callableOptions, async (req) => {
  const documentId = typeof req.data?.documentId === 'string' ? req.data.documentId : '';
  if (!documentId) throw invalid('Which document?');

  const portal = portalClaim(req.auth?.token ?? ({} as never));
  if (!portal) throw denied('Open the secure link we emailed you.');
  const { firmId, clientId } = portal;
  const caller = requirePortal(req, firmId, clientId);

  const docRef = db.doc(paths.document(firmId, clientId, documentId));

  const requestId = await db.runTransaction(async (tx) => {
    const snap = await tx.get(docRef);
    if (!snap.exists) throw notFound('That document is no longer on file.');
    const document = snap.data() as StoredDocument;

    if (document.uploadedVia !== 'portal') {
      throw denied('Your accountant added this one. Ask them to remove it.');
    }
    if (document.state === 'retracted') return document.requestId;
    if (document.state === 'accepted') {
      throw denied(
        'Your accountant has already reviewed this one. Message them and they can swap it out.',
      );
    }
    if (Date.now() - tsMillis(document.uploadedAt) > RETRACT_WINDOW_MS) {
      throw denied('This one has been on file too long to withdraw. Ask your accountant to remove it.');
    }

    // Firestore transactions require every read before any write, so the
    // request is fetched here rather than after the document is updated.
    const reqRef = document.requestId
      ? db.doc(paths.request(firmId, clientId, document.requestId))
      : null;
    const reqSnap = reqRef ? await tx.get(reqRef) : null;

    tx.update(docRef, {
      state: 'retracted' satisfies DocumentState,
      retractedAt: FieldValue.serverTimestamp(),
    });

    // Reopen whatever it was satisfying, unless another document still covers it.
    if (reqRef && reqSnap?.exists) {
      const request = reqSnap.data() as DocRequest;
      const remaining = (request.documentIds ?? []).filter((id) => id !== documentId);
      tx.update(reqRef, {
        documentIds: remaining,
        status: remaining.length ? request.status : ('pending' satisfies RequestStatus),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    return document.requestId;
  });

  await logActivity(firmId, {
    type: 'document_retracted',
    summary: 'Client withdrew a document they had uploaded',
    actor: {
      kind: 'client',
      uid: caller.uid,
      name: cleanName(caller.token.name, 1, 120) ?? normEmail(caller.token.email) ?? 'The client',
    },
    clientId,
    meta: { documentId, requestId: requestId ?? null },
  });

  return { ok: true };
});
