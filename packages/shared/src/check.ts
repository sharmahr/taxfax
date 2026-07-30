/**
 * Self-check for the shared domain logic. `node --experimental-strip-types check.ts`
 * Deliberately assert-based and framework-free — it exists to fail loudly when
 * the checklist rules, cadence maths or canonical naming drift.
 */
import assert from 'node:assert/strict';
import { emptyPriorYear, generateChecklist, STARTER_CHECKLIST } from './checklist.ts';
import { canonicalName, clientToken, documentPath, parseDocumentPath, slugify } from './naming.ts';
import { cadenceCompression, nextSendableSlot, renderEmail, renderSms, stepDueAt } from './chase.ts';
import { CHASE_PROFILES } from './chase.ts';
import { DOC_TYPES, docType } from './taxonomy.ts';

// ── Taxonomy ────────────────────────────────────────────────────────────────

{
  const ids = DOC_TYPES.map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length, 'doc type ids must be unique');
  const slugs = DOC_TYPES.map((d) => d.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'doc type slugs must be unique');
  for (const d of DOC_TYPES) {
    assert.ok(d.label.length > 0 && d.hint.length > 0, `${d.id} needs a label and a taxpayer hint`);
    for (const p of [...d.match.strong, ...(d.match.weak ?? []), ...(d.match.veto ?? [])]) {
      new RegExp(p, 'i'); // throws on a malformed pattern
    }
  }
  // Every checklist rule and starter item must point at a real doc type.
  for (const s of STARTER_CHECKLIST) docType(s.docTypeId);
}

// ── Checklist generation ────────────────────────────────────────────────────

{
  // A wage earner with a mortgage, two kids and a brokerage account.
  const prior = emptyPriorYear(2024);
  prior.formType = '1040';
  prior.filingStatus = 'mfj';
  prior.dependents = 2;
  prior.state = 'CA';
  prior.itemized = true;
  prior.schedules = ['A', 'B', 'D'];
  prior.lines = { '1z': 184_000, '2b': 1_240, '3a': 890, '7': 12_500 };
  prior.documentCounts = { w2: 2, '1098': 1, '1099-div': 1, '1099-b': 1 };
  prior.issuers = [
    { docTypeId: 'w2', name: 'Acme Corp' },
    { docTypeId: 'w2', name: 'Northwind LLC' },
    { docTypeId: '1098', name: 'Wells Fargo' },
  ];
  prior.confidence = 0.94;

  const hits = generateChecklist({ prior, taxYear: 2025 });
  const byId = new Map(hits.map((h) => [h.docTypeId, h]));

  assert.ok(hits.length >= 6, 'a rich prior year should yield a substantial checklist');
  assert.equal(byId.get('w2')?.quantity, 2, 'two W-2s last year means two expected this year');
  assert.deepEqual(byId.get('w2')?.issuers, ['Acme Corp', 'Northwind LLC']);
  assert.match(byId.get('w2')!.reason, /Acme Corp/, 'the reason must name the actual employers');
  assert.ok(byId.has('1098'), 'an itemizer with a 1098 last year needs one again');
  assert.ok(byId.has('1099-div'), 'Schedule B dividends imply a 1099-DIV');

  // Every hit must be actionable: real doc type, positive quantity, a reason a
  // taxpayer can read.
  for (const h of hits) {
    docType(h.docTypeId);
    assert.ok(h.quantity > 0, `${h.docTypeId} quantity`);
    assert.ok(h.reason.length > 12 && /[.!]$/.test(h.reason), `${h.docTypeId} reason: ${h.reason}`);
  }
  assert.equal(new Set(hits.map((h) => h.docTypeId)).size, hits.length, 'no duplicate doc types');

  // An empty parse must not invent income documents — only the unconditional
  // engagement items every filer owes regardless of last year.
  const bare = generateChecklist({ prior: emptyPriorYear(2024), taxYear: 2025 });
  for (const h of bare) {
    const cat = docType(h.docTypeId).category;
    assert.ok(
      cat === 'admin' || cat === 'identity' || cat === 'property',
      `nothing in ${cat} should be invented without a prior-year signal (${h.docTypeId})`,
    );
  }
  assert.ok(!bare.some((h) => h.docTypeId === 'w2'), 'no W-2 without a wage signal');
}

{
  // A sole proprietor: Schedule C must pull business documents, not just wages.
  const prior = emptyPriorYear(2024);
  prior.formType = '1040';
  prior.entityType = 'individual';
  prior.schedules = ['C', 'SE'];
  prior.lines = { '8': 96_000 };
  prior.documentCounts = { '1099-nec': 3 };
  const ids = generateChecklist({ prior, taxYear: 2025 }).map((h) => h.docTypeId);
  assert.ok(ids.includes('1099-nec'), 'Schedule C filers need their 1099-NECs');
  assert.ok(!ids.includes('1098-t'), 'no tuition statement without a prior-year signal');
}

// ── Canonical naming ────────────────────────────────────────────────────────

{
  assert.equal(
    canonicalName({
      clientDisplayName: 'Eleanor Whitfield',
      taxYear: 2025,
      docTypeId: 'w2',
      issuer: 'Acme Corp',
      originalName: 'scan_0001.PDF',
      contentType: 'application/pdf',
    }),
    'WhitfieldE_2025_W2_AcmeCorp.pdf',
  );

  // Second W-2 from the same employer gets a suffix; the first never does.
  const base = {
    clientDisplayName: 'Eleanor Whitfield',
    taxYear: 2025,
    docTypeId: 'w2',
    issuer: 'Acme Corp',
    originalName: 'a.pdf',
    contentType: 'application/pdf',
  };
  assert.equal(canonicalName({ ...base, sequence: 1 }), canonicalName(base));
  assert.match(canonicalName({ ...base, sequence: 2 }), /_02\.pdf$/);

  // Hostile inputs must not escape the filename or the path.
  assert.equal(slugify('../../etc/passwd'), 'EtcPasswd', 'path traversal must be neutralised');
  assert.ok(!clientToken('  🙂  ').includes('/'));
  const nasty = canonicalName({
    clientDisplayName: 'Ünïcode / Näme',
    taxYear: 2025,
    docTypeId: '1099-int',
    issuer: 'A/B "Bank" <x>',
    originalName: 'file',
    contentType: 'image/jpeg',
  });
  assert.ok(!/[/\\<>":*?|]/.test(nasty), `unsafe filename: ${nasty}`);
  assert.match(nasty, /\.jpg$/, 'extension comes from content type when the name has none');

  // Path round-trip.
  const p = documentPath('firm_1', 2025, 'client_9', 'doc_3', nasty);
  assert.deepEqual(parseDocumentPath(p), {
    firmId: 'firm_1',
    taxYear: 2025,
    clientId: 'client_9',
    documentId: 'doc_3',
    fileName: nasty,
  });
  assert.equal(parseDocumentPath('firms/firm_1/assets/logo.png'), null);
}

// ── Chase cadence ───────────────────────────────────────────────────────────

{
  // Compression is monotonic: closer to the deadline is never more relaxed.
  let prev = 0;
  for (const d of [3, 10, 20, 60]) {
    const c = cadenceCompression(d);
    assert.ok(c > prev, `compression must increase with runway (${d}d)`);
    assert.ok(c > 0 && c <= 1);
    prev = c;
  }

  const start = new Date('2026-02-02T15:00:00Z'); // a Monday
  assert.ok(
    stepDueAt(start, 10, 5).getTime() < stepDueAt(start, 10, 90).getTime(),
    'a near deadline must pull the step earlier',
  );

  // Every profile escalates and stays inside the step budget.
  for (const profile of Object.values(CHASE_PROFILES)) {
    assert.ok(profile.steps.length > 0, `${profile.id} has steps`);
    let last = -1;
    for (const s of profile.steps) {
      assert.ok(s.dayOffset > last, `${profile.id} steps must be strictly ordered`);
      last = s.dayOffset;
      assert.ok(s.channels.length > 0, `${profile.id} step ${s.dayOffset} needs a channel`);
    }
  }
}

{
  // Quiet hours and weekends. Treat the date as UTC for the probe functions so
  // the check is timezone-independent.
  const hourInTz = (d: Date) => d.getUTCHours();
  const dayInTz = (d: Date) => d.getUTCDay();
  const settings = { quietHours: { start: 20, end: 8 }, sendOnWeekends: false };

  const midnight = nextSendableSlot(new Date('2026-02-03T02:00:00Z'), settings, hourInTz, dayInTz);
  assert.ok(hourInTz(midnight) >= 8 && hourInTz(midnight) < 20, `quiet hours leaked: ${midnight}`);

  const saturday = nextSendableSlot(new Date('2026-02-07T15:00:00Z'), settings, hourInTz, dayInTz);
  assert.ok(![0, 6].includes(dayInTz(saturday)), `weekend leaked: ${saturday}`);

  // Already fine — must be left alone.
  const ok = new Date('2026-02-03T15:00:00Z');
  assert.equal(nextSendableSlot(ok, settings, hourInTz, dayInTz).getTime(), ok.getTime());

  // Exhaustive: every hour of a full week must resolve to a legal slot that is
  // never earlier than the candidate. This is what catches the Friday-evening
  // case, where the walk has to clear ~60 hours to reach Monday morning.
  const weekStart = Date.parse('2026-02-02T00:00:00Z'); // Monday
  for (let h = 0; h < 24 * 7; h++) {
    const cand = new Date(weekStart + h * 3_600_000);
    const slot = nextSendableSlot(cand, settings, hourInTz, dayInTz);
    const sh = hourInTz(slot);
    assert.ok(slot.getTime() >= cand.getTime(), `went backwards from ${cand.toISOString()}`);
    assert.ok(sh >= 8 && sh < 20, `quiet hours leaked from ${cand.toISOString()} → ${slot.toISOString()}`);
    assert.ok(
      ![0, 6].includes(dayInTz(slot)),
      `weekend leaked from ${cand.toISOString()} → ${slot.toISOString()}`,
    );
    assert.ok(
      slot.getTime() - cand.getTime() <= 3 * 24 * 3_600_000,
      `deferred too far from ${cand.toISOString()} → ${slot.toISOString()}`,
    );
  }

  // No quiet hours configured: only the weekend rule applies.
  const always = { quietHours: { start: 0, end: 0 }, sendOnWeekends: true };
  const midnightSend = new Date('2026-02-03T02:00:00Z');
  assert.equal(
    nextSendableSlot(midnightSend, always, hourInTz, dayInTz).getTime(),
    midnightSend.getTime(),
  );

  // Firms that allow weekends get their Saturday send.
  const weekendOk = nextSendableSlot(
    new Date('2026-02-07T15:00:00Z'),
    { ...settings, sendOnWeekends: true },
    hourInTz,
    dayInTz,
  );
  assert.equal(weekendOk.getTime(), new Date('2026-02-07T15:00:00Z').getTime());
}

// ── Message copy ────────────────────────────────────────────────────────────

{
  const copy = {
    clientFirstName: 'Eleanor',
    firmName: 'Whitfield & Rowe',
    preparerName: 'Ava Okonkwo',
    outstanding: ['W-2', 'Form 1098', '1099-DIV', '1099-B'],
    outstandingCount: 4,
    totalCount: 11,
    portalUrl: 'https://taxfax.app/p/abc123',
    daysWaiting: 9,
    daysToDeadline: 26,
    signature: 'Ava Okonkwo · Whitfield & Rowe',
  };

  for (const tone of ['warm', 'neutral', 'firm', 'urgent', 'final'] as const) {
    const email = renderEmail(tone, copy);
    assert.ok(email.subject.length > 0 && email.subject.length <= 78, `${tone} subject length`);
    assert.ok(!/\{\{|\bundefined\b|\bNaN\b/.test(email.subject + email.body), `${tone} unrendered token`);
    assert.match(email.body, /Eleanor/, `${tone} must address the taxpayer`);
    assert.ok(email.body.includes(copy.portalUrl), `${tone} must link the portal`);

    const sms = renderSms(tone, copy);
    assert.ok(sms.length > 0 && sms.length <= 320, `${tone} sms length ${sms.length}`);
    assert.ok(sms.includes(copy.portalUrl), `${tone} sms must link the portal`);
    assert.ok(!/\{\{|\bundefined\b/.test(sms), `${tone} sms unrendered token`);
  }

  // A single outstanding item must not read like a list.
  const one = renderEmail('warm', { ...copy, outstanding: ['W-2'], outstandingCount: 1 });
  assert.ok(!/,\s*plus/.test(one.body), 'singular case should not say "plus N more"');
}

console.log('shared: all checks passed');
