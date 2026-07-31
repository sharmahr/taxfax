/**
 * The outbound mail templates, against a hostile name.
 *
 * TaxFax is passwordless: the email carrying a sign-in link is the whole
 * authentication ceremony. Client names reach that email from a CSV import —
 * which is to say from outside the firm — and the importer stores them
 * verbatim, so the escaping in `lib/mail.ts` is the only thing between an
 * imported name and markup rendering inside a message whose entire job is to
 * say "this link really is from your accountant".
 *
 * These assertions are written to fail if the escaping is removed, not merely
 * to describe it: they look for markup and attribute break-outs in the rendered
 * HTML, and for their absence in the rendered text. No emulator, no network —
 * the templates are pure.
 *
 *   node --experimental-strip-types --test functions/src/lib/mail.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, memberInviteEmail, portalInviteEmail } from './mail.ts';

/**
 * One string carrying every shape of the attack at once: a script element, an
 * attribute break-out with an event handler, both quote forms, a bare `&`, and
 * a right-to-left override that reverses everything after it on screen.
 */
const HOSTILE =
  `<script>alert(1)</script>" onerror="alert(2)" ' onmouseover='alert(3) & <img src=x onerror=alert(4)>\u202eGnitnuocca`;

const LINK = 'https://taxfax-364f6.web.app/portal/enter?email=a%40b.com&mode=signIn';

/** Tags this repo's templates actually emit. Anything else came from a name. */
const OUR_TAGS = /^<\/?(?:p|strong|a)(?:\s[^>]*)?>$/i;

/** The rendered HTML must contain no tag we did not write ourselves. */
function assertNoInjectedMarkup(html: string): void {
  assert.ok(!/<script/i.test(html), 'a <script> element survived into the HTML body');
  assert.ok(!/<img/i.test(html), 'an <img> element survived into the HTML body');
  assert.ok(!/\u202e/.test(html), 'a right-to-left override survived into the HTML body');
  for (const tag of html.match(/<[^>]*>/g) ?? []) {
    assert.ok(OUR_TAGS.test(tag), `a tag we never wrote appeared in the HTML: ${tag}`);
    assert.ok(!/\son\w+\s*=/i.test(tag), `an event-handler attribute reached a tag: ${tag}`);
  }
}

/**
 * Every `"` in the document must be one of ours: a quote that opens or closes
 * an attribute we wrote. Counting them is how an attribute break-out shows up —
 * an injected quote leaves an odd number inside a tag.
 */
function assertNoAttributeBreakout(html: string): void {
  for (const tag of html.match(/<[^>]*>/g) ?? []) {
    const quotes = (tag.match(/"/g) ?? []).length;
    assert.equal(quotes % 2, 0, `unbalanced quotes inside a tag — attribute break-out: ${tag}`);
    assert.ok(!/'/.test(tag), `a raw apostrophe reached a tag: ${tag}`);
  }
  // The href must end where we ended it, with nothing appended after the URL.
  for (const href of html.match(/href="[^"]*"/g) ?? []) {
    assert.ok(!/\s/.test(href), `an href picked up whitespace, so it picked up an attribute: ${href}`);
  }
}

describe('escapeHtml', () => {
  it('encodes every character that can change the meaning of markup', () => {
    assert.equal(
      escapeHtml(`<a href="x" title='y'>&</a>`),
      '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });

  it('encodes the ampersand first, so an escape cannot be double-decoded', () => {
    assert.equal(escapeHtml('&lt;script&gt;'), '&amp;lt;script&amp;gt;');
  });

  it('drops bidi overrides but keeps the isolates the chase copy renders with', () => {
    assert.equal(escapeHtml('Acme\u202eemcA'), 'AcmeemcA');
    assert.equal(escapeHtml('\u2068W-2\u2069'), '\u2068W-2\u2069');
  });
});

describe('portalInviteEmail — the passwordless sign-in mail', () => {
  const mail = portalInviteEmail({
    greeting: HOSTILE,
    preparerName: HOSTILE,
    brand: HOSTILE,
    link: LINK,
  });

  it('renders a hostile name as text, not as markup', () => {
    assertNoInjectedMarkup(mail.html);
    assertNoAttributeBreakout(mail.html);
    assert.ok(mail.html.includes('&lt;script&gt;'), 'the name should still be readable, just inert');
  });

  it('keeps the sign-in link intact inside its href', () => {
    assert.ok(
      mail.html.includes(`<a href="${LINK.replace(/&/g, '&amp;')}">`),
      'the sign-in link must survive escaping — an encoded & is still the same URL to a mail client',
    );
  });

  it('leaves the plain-text part unescaped', () => {
    assert.ok(!mail.text.includes('&amp;'), 'an HTML entity in the text part shows up literally in the inbox');
    assert.ok(!mail.text.includes('&lt;'), 'an HTML entity in the text part shows up literally in the inbox');
    assert.ok(mail.text.includes(LINK), 'the text part must carry the link exactly as Firebase issued it');
    assert.ok(mail.text.includes(HOSTILE), 'the text part is text; it carries the name as typed');
  });

  it('escapes a hostile brand in the HTML but not in the subject line', () => {
    assert.ok(mail.subject.includes(HOSTILE), 'the subject is a header, not markup');
  });
});

describe('memberInviteEmail — the staff invite mail', () => {
  const acceptUrl = 'https://taxfax-364f6.web.app/invite/AbC-123_xyz';
  const mail = memberInviteEmail({
    firmName: HOSTILE,
    inviterName: HOSTILE,
    roleLabel: 'Preparer',
    acceptUrl,
    expiresInDays: 14,
  });

  it('renders a hostile firm or inviter name as text, not as markup', () => {
    assertNoInjectedMarkup(mail.html);
    assertNoAttributeBreakout(mail.html);
  });

  it('keeps the accept link intact inside its href', () => {
    assert.ok(mail.html.includes(`<a href="${acceptUrl}">`));
  });

  it('leaves the plain-text part unescaped', () => {
    assert.ok(!mail.text.includes('&amp;'));
    assert.ok(!mail.text.includes('&lt;'));
    assert.ok(mail.text.includes(acceptUrl));
  });
});
