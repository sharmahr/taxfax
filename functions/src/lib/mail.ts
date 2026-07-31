/**
 * The bodies of the messages we send, and the escaping that makes them safe to
 * render.
 *
 * TaxFax is passwordless, so an email carrying a sign-in link *is* the
 * authentication boundary — its only job is to convince a taxpayer that the
 * link really came from their accountant. Names reach these templates from a
 * CSV import, which means from outside the firm, so anything interpolated into
 * the HTML part is attacker-influenced until proven otherwise. Escaping is
 * therefore not cosmetic here; it is what stops our own sender, on our own
 * domain, from being turned into a phishing primitive.
 *
 * The templates live here rather than next to their callables so the rendering
 * is a pure function of its copy, testable without an emulator, and so every
 * outbound message escapes through one implementation instead of each call site
 * remembering to.
 *
 * Deliberately dependency-free — no admin SDK, no shared package — so importing
 * it costs nothing and a test can load it directly.
 */

/**
 * Encodes a string for interpolation into HTML: element text *and* quoted
 * attribute values, so no call site has to work out which context it is in.
 * Both quote forms matter — the chase renderer puts linkified URLs inside
 * `href="…"`, and a `"` that survives escaping is an attribute break-out.
 *
 * The legacy bidi *overrides* (U+202A–U+202E) are dropped rather than encoded.
 * They are display control, not text: a name ending in RLO visually reverses
 * the rest of the line, which in a "this really is your accountant" email is a
 * spoof even when no markup executes. The bidi *isolates* (U+2066–U+2069) that
 * the localized chase copy emits are deliberate and left alone — `textToHtml`
 * turns them into `<bdi>`.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/[\u202a-\u202e]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface OutboundMessage {
  subject: string;
  text: string;
  html: string;
}

export interface PortalInviteCopy {
  /** The taxpayer's first name — from a client record, so untrusted. */
  greeting: string;
  /** The preparer's display name, off the caller's auth token. Untrusted. */
  preparerName: string;
  /** The firm's branding name. Firm-authored, still user input. */
  brand: string;
  /** Firebase email-link sign-in URL. Goes into an href, so attribute-escaped. */
  link: string;
}

/**
 * The taxpayer's portal invite. The plain-text part is deliberately *not*
 * escaped: it is delivered as text/plain, so an `&amp;` there would show up
 * verbatim in a real taxpayer's inbox.
 */
export function portalInviteEmail(c: PortalInviteCopy): OutboundMessage {
  const greeting = escapeHtml(c.greeting);
  const preparerName = escapeHtml(c.preparerName);
  const brand = escapeHtml(c.brand);
  const link = escapeHtml(c.link);

  const subject = `Your secure document portal for ${c.brand}`;
  const text = `Hi ${c.greeting},

${c.preparerName} at ${c.brand} has set up a secure portal for your tax documents. No password to remember — just open this link to get in:

${c.link}

Once you're in you'll see exactly what we need and can upload straight from your phone. Photos are fine; we straighten and rename everything for you.

This link is just for you, so please don't forward it.

— ${c.brand}`;
  const html = `<p>Hi ${greeting},</p>
<p><strong>${preparerName}</strong> at <strong>${brand}</strong> has set up a secure portal for your tax documents. No password to remember — just open this link to get in:</p>
<p><a href="${link}">Open my document portal</a></p>
<p>Once you're in you'll see exactly what we need and can upload straight from your phone. Photos are fine; we straighten and rename everything for you.</p>
<p style="color:#6b7280;font-size:13px">This link is just for you, so please don't forward it.</p>
<p>— ${brand}</p>`;
  return { subject, text, html };
}

export interface MemberInviteCopy {
  /** Firm branding or firm name. Untrusted. */
  firmName: string;
  /** The inviting teammate's name, off their auth token. Untrusted. */
  inviterName: string;
  /** `ROLE_LABEL[role]` — one of four literals we ship. Not user input. */
  roleLabel: string;
  /** `${allow-listed origin}/invite/${token}`. Goes into an href. */
  acceptUrl: string;
  expiresInDays: number;
}

export function memberInviteEmail(c: MemberInviteCopy): OutboundMessage {
  const firmName = escapeHtml(c.firmName);
  const inviterName = escapeHtml(c.inviterName);
  const acceptUrl = escapeHtml(c.acceptUrl);
  // `roleLabel` is not escaped on purpose: it can only ever be one of the four
  // ROLE_LABEL constants, and escaping known-safe literals to look thorough
  // hides which values actually need it.

  const subject = `${c.inviterName} added you to ${c.firmName} on TaxFax`;
  const text = `${c.inviterName} has invited you to join ${c.firmName} on TaxFax as ${c.roleLabel}.

TaxFax is where the firm collects tax documents from clients — no more chasing email threads.

Accept your invite:
${c.acceptUrl}

This link works for the next ${c.expiresInDays} days. If you weren't expecting it, you can ignore this email.`;
  const html = `<p>${inviterName} has invited you to join <strong>${firmName}</strong> on TaxFax as <strong>${c.roleLabel}</strong>.</p>
<p>TaxFax is where the firm collects tax documents from clients — no more chasing email threads.</p>
<p><a href="${acceptUrl}">Accept your invite</a></p>
<p style="color:#6b7280;font-size:13px">This link works for the next ${c.expiresInDays} days. If you weren't expecting it, you can ignore this email.</p>`;
  return { subject, text, html };
}
