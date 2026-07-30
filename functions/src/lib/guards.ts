/**
 * Request guards for callables. Authorization is read straight from the custom
 * claims minted by `syncClaimsFor`, so these checks never touch Firestore.
 */
import type { CallableRequest } from 'firebase-functions/v2/https';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { ROLE_LABEL, ROLE_RANK, type FirmRole } from '@taxfax/shared';
import { denied, unauth } from './errors.js';

export interface Caller {
  uid: string;
  token: DecodedIdToken;
}

export interface FirmCaller extends Caller {
  role: FirmRole;
}

export function requireAuth(req: CallableRequest): Caller {
  if (!req.auth) {
    throw unauth('Please sign in and try again.');
  }
  return { uid: req.auth.uid, token: req.auth.token };
}

export function firmRoles(token: DecodedIdToken): Record<string, FirmRole> {
  const claim = (token as { firms?: unknown }).firms;
  return claim && typeof claim === 'object' ? (claim as Record<string, FirmRole>) : {};
}

export function roleFor(token: DecodedIdToken, firmId: string): FirmRole | null {
  const role = firmRoles(token)[firmId];
  return role && role in ROLE_RANK ? role : null;
}

export function requireFirmRole(
  req: CallableRequest,
  firmId: string,
  min: FirmRole,
): FirmCaller {
  const caller = requireAuth(req);
  const role = roleFor(caller.token, firmId);
  if (!role) {
    throw denied("You don't have access to this workspace.");
  }
  if (ROLE_RANK[role] < ROLE_RANK[min]) {
    throw denied(
      `That needs ${ROLE_LABEL[min]} access. Ask an owner or admin to change your role.`,
    );
  }
  return { ...caller, role };
}

export function portalClaim(token: DecodedIdToken): { firmId: string; clientId: string } | null {
  const claim = (token as { portal?: unknown }).portal;
  if (!claim || typeof claim !== 'object') return null;
  const { firmId, clientId } = claim as { firmId?: unknown; clientId?: unknown };
  return typeof firmId === 'string' && typeof clientId === 'string'
    ? { firmId, clientId }
    : null;
}

export function requirePortal(req: CallableRequest, firmId: string, clientId: string): Caller {
  const caller = requireAuth(req);
  const portal = portalClaim(caller.token);
  if (!portal || portal.firmId !== firmId || portal.clientId !== clientId) {
    throw denied("This secure link isn't for this file. Ask your accountant to resend it.");
  }
  return caller;
}
