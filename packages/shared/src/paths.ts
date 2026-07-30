/**
 * Firestore path helpers. Every read and write in the product goes through
 * these, so the tenancy shape is stated exactly once.
 */

export const paths = {
  firm: (firmId: string) => `firms/${firmId}`,
  members: (firmId: string) => `firms/${firmId}/members`,
  member: (firmId: string, uid: string) => `firms/${firmId}/members/${uid}`,

  clients: (firmId: string) => `firms/${firmId}/clients`,
  client: (firmId: string, clientId: string) => `firms/${firmId}/clients/${clientId}`,

  requests: (firmId: string, clientId: string) =>
    `firms/${firmId}/clients/${clientId}/requests`,
  request: (firmId: string, clientId: string, requestId: string) =>
    `firms/${firmId}/clients/${clientId}/requests/${requestId}`,

  documents: (firmId: string, clientId: string) =>
    `firms/${firmId}/clients/${clientId}/documents`,
  document: (firmId: string, clientId: string, documentId: string) =>
    `firms/${firmId}/clients/${clientId}/documents/${documentId}`,

  chaseMessages: (firmId: string, clientId: string) =>
    `firms/${firmId}/clients/${clientId}/chaseMessages`,

  activity: (firmId: string) => `firms/${firmId}/activity`,
  templates: (firmId: string) => `firms/${firmId}/templates`,

  user: (uid: string) => `users/${uid}`,
  invite: (token: string) => `invites/${token}`,
  portalGrant: (uid: string) => `portalGrants/${uid}`,

  /** Written by the `firestore-send-email` extension. */
  mail: () => 'mail',
  /** Written by the `twilio-send-message` extension. */
  sms: () => 'messages',
} as const;

/** Collection-group ids used by scheduled scans and cross-firm queries. */
export const groups = {
  clients: 'clients',
  requests: 'requests',
  documents: 'documents',
} as const;
