import { useEffect, useRef, useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  CHECKLIST_RULES,
  emptyPriorYear,
  generateChecklist,
  type PriorYearReturn,
} from '@taxfax/shared';
import { cn } from '@/lib/cn';
import { Section, SectionHead } from './Section';

/* ─────────────────────────────────────────────────────────────────────────────
   The example return. These are the facts a parsed 1040 produces, and the
   checklist below is generated from them by the same `generateChecklist` the
   product runs. Nothing on the right-hand side is written by hand.
   ───────────────────────────────────────────────────────────────────────────*/

const PRIOR: PriorYearReturn = {
  ...emptyPriorYear(2024),
  formType: '1040',
  entityType: 'individual',
  filingStatus: 'mfj',
  taxpayerName: 'Eleanor Whitfield',
  spouseName: 'Marcus Whitfield',
  dependents: 1,
  state: 'OR',
  schedules: ['1', 'A', 'B', 'D', 'E'],
  itemized: true,
  lines: { '1z': 148500, '2b': 1240, '3b': 3180, '7': 6420, '26': 4000, 'schA-14': 6800 },
  issuers: [
    { docTypeId: 'w2', name: 'Riverbend Health' },
    { docTypeId: 'w2', name: 'Cascade School District' },
    { docTypeId: '1099-int', name: 'Umpqua Bank' },
    { docTypeId: '1099-div', name: 'Vanguard' },
    { docTypeId: '1099-b', name: 'Vanguard' },
    { docTypeId: '1098', name: 'Provident Home Loans' },
    { docTypeId: 'rental-summary', name: '44 Alder St' },
  ],
  documentCounts: { w2: 2, '1099-int': 1, '1099-div': 1, '1099-b': 1, '1098': 1, 'rental-summary': 1 },
  confidence: 0.97,
};

const HITS = generateChecklist({ prior: PRIOR, taxYear: 2025 });
const HIT_TYPES = new Set(HITS.map((h) => h.docTypeId));
/** Every rule that read this return and found nothing to ask for. */
const QUIET = CHECKLIST_RULES.filter((r) => !HIT_TYPES.has(r.docTypeId)).map((r) => r.id);

/** Short codes, copied from the taxonomy in `packages/shared/src/taxonomy.ts`. */
const CODE: Record<string, string> = {
  'engagement-letter': 'Engagement',
  'photo-id': 'ID',
  w2: 'W-2',
  '1099-int': '1099-INT',
  '1099-div': '1099-DIV',
  '1099-b': '1099-B',
  'mileage-log': 'Mileage',
  'asset-schedule': 'Assets',
  'rental-summary': 'Rental',
  '1098': '1098',
  'property-tax': 'Property tax',
  'closing-statement': 'Closing',
  charitable: 'Charity',
  'estimated-payments': 'Estimates',
  'voided-check': 'Bank',
};

/** Where on the return each request came from. `null` means it is asked of everyone. */
const SOURCE: Record<string, { key: string; cite: string } | null> = {
  'engagement-letter': null,
  'photo-id': { key: 'status', cite: 'MFJ' },
  w2: { key: '1z', cite: 'line 1z' },
  '1099-int': { key: '2b', cite: 'line 2b' },
  '1099-div': { key: '3b', cite: 'line 3b' },
  '1099-b': { key: 'D', cite: 'Sch. D' },
  'mileage-log': { key: 'E', cite: 'Sch. E' },
  'asset-schedule': { key: 'E', cite: 'Sch. E' },
  'rental-summary': { key: 'E', cite: 'Sch. E' },
  '1098': { key: 'A', cite: 'Sch. A' },
  'property-tax': { key: 'A', cite: 'Sch. A' },
  'closing-statement': null,
  charitable: { key: 'A', cite: 'Sch. A' },
  'estimated-payments': { key: '26', cite: 'line 26' },
  'voided-check': null,
};

const CITED = HITS.filter((h) => SOURCE[h.docTypeId]).length;
const UNIVERSAL = HITS.length - CITED;
/** Lines of the return that at least one request was derived from. */
const USED = new Set(
  HITS.map((h) => SOURCE[h.docTypeId]?.key).filter((k): k is string => Boolean(k)),
);

const RETURN_LINES: { key: string | null; no: string; label: string; value: string }[] = [
  { key: '1z', no: '1z', label: 'Total amount from Form(s) W-2, box 1', value: '148,500' },
  { key: '2b', no: '2b', label: 'Taxable interest', value: '1,240' },
  { key: '3b', no: '3b', label: 'Ordinary dividends', value: '3,180' },
  { key: 'D', no: '7', label: 'Capital gain or loss. Attach Schedule D', value: '6,420' },
  { key: 'E', no: '8', label: 'Additional income from Schedule 1, line 10', value: '21,940' },
  { key: null, no: '9', label: 'Total income', value: '181,280' },
  { key: 'A', no: '12', label: 'Itemized deductions from Schedule A', value: '34,610' },
  { key: '26', no: '26', label: '2024 estimated tax payments', value: '4,000' },
];

const SCHEDULES: { token: string; key: string | null }[] = [
  { token: '1', key: null },
  { token: 'A', key: 'A' },
  { token: 'B', key: null },
  { token: 'D', key: 'D' },
  { token: 'E', key: 'E' },
];

const PRIORITY_TONE: Record<string, string> = {
  critical: 'text-ink',
  standard: 'text-ink',
  optional: 'text-ink-muted',
};

const STEP_MS = 90;

export function Derivation() {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(() =>
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
      ? HITS.length
      : -1,
  );
  const [hovered, setHovered] = useState<string | null>(null);

  // Start reading when the artifact is on screen, once.
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || armed) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setArmed(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -20% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [armed]);

  useEffect(() => {
    if (!armed || step >= HITS.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), step < 0 ? 260 : STEP_MS);
    return () => clearTimeout(t);
  }, [armed, step]);

  const running = step >= 0 && step < HITS.length;
  const settled = step >= HITS.length;
  const active = running ? (SOURCE[HITS[step]!.docTypeId]?.key ?? null) : hovered;
  const mark = (key: string | null) =>
    key && active === key ? 'mk-cited' : key && settled && USED.has(key) ? 'mk-used' : undefined;

  return (
    <Section id="checklist" label="The checklist">
      <SectionHead title="It reads last year&rsquo;s return and asks for this year&rsquo;s version of it.">
        Everywhere else, someone on your staff opens a blank template and fills it in by hand, four
        hundred times, guessing at what each client will need. TaxFax parses the prior-year 1040 and
        derives the list from what is actually on it.
      </SectionHead>

      <div
        ref={ref}
        className="mt-10 grid gap-px overflow-hidden border border-line bg-line lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)]"
      >
        {/* ── The return on file ─────────────────────────────────────────── */}
        <div className="bg-surface-sunken px-4 py-5 sm:px-6">
          <p className="mk-eyebrow text-ink-muted">On file</p>
          <p className="display mt-1 text-[1.5rem] leading-tight text-ink">Form 1040 (2024)</p>
          <p
            className={cn(
              'mk-cite-mark ticket -mx-2 mt-2 px-2 py-1 text-ink-muted',
              mark('status'),
            )}
          >
            Whitfield, Eleanor and Marcus
            <span className="block text-ink-muted">Married filing jointly, 1 dependent</span>
          </p>

          <dl className="mt-4 border-t border-line" data-tabular>
            {RETURN_LINES.map((l) => (
              <div
                key={l.no}
                className={cn(
                  'mk-cite-mark -mx-2 flex items-baseline gap-3 border-b border-line px-2 py-1.5',
                  mark(l.key),
                )}
              >
                <dt className="flex min-w-0 items-baseline gap-2.5">
                  <span className="ticket w-6 shrink-0 text-ink-muted">{l.no}</span>
                  <span className="text-[0.75rem] leading-snug text-ink-muted">{l.label}</span>
                </dt>
                <dd className="ticket ml-auto shrink-0 text-ink">{l.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 flex items-center gap-2">
            <span className="mk-eyebrow text-ink-muted">Schedules</span>
            {SCHEDULES.map((s) => (
              <span
                key={s.token}
                className={cn(
                  'mk-cite-mark ticket inline-flex size-5 items-center justify-center border border-line text-ink-muted',
                  s.key && active === s.key && 'border-stamp text-stamp',
                  mark(s.key),
                )}
              >
                {s.token}
              </span>
            ))}
          </div>

          <div className="mt-7 border-t border-line pt-4">
            <p className="mk-eyebrow text-ink-muted">
              Rules that read it and stayed quiet &middot; {QUIET.length} of{' '}
              {CHECKLIST_RULES.length}
            </p>
            <ul className="mt-2.5 flex flex-wrap gap-x-2 gap-y-1 text-[0.6875rem] leading-[1.6] text-ink-muted">
              {QUIET.map((id) => (
                <li key={id} className="font-mono whitespace-nowrap">
                  {id}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[0.75rem] leading-[1.55] text-ink-muted">
              No Schedule C, no K-1s, no tuition, no Marketplace coverage. So none of it was asked
              for, and she is not answering questions about a business she does not have.
            </p>
          </div>

          <div className="mt-5 flex items-baseline gap-3 border-t border-line pt-4">
            <span className="ticket shrink-0 text-ink">{PRIOR.confidence.toFixed(2)}</span>
            <span className="text-[0.75rem] leading-[1.55] text-ink-muted">
              Parse confidence on the return above. The list is a draft until a preparer sends it,
              and nothing is chased before that.
            </span>
          </div>
        </div>

        {/* ── What it asked for ──────────────────────────────────────────── */}
        <div className="bg-surface px-4 py-5 sm:px-6">
          <div className="flex items-baseline justify-between gap-4 border-b border-line-strong pb-2">
            <p className="mk-eyebrow text-ink-muted">Requested for 2025</p>
            <p className="ticket text-ink-muted">
              {HITS.length} items
            </p>
          </div>

          <ol className="mt-1">
            {HITS.map((hit, i) => {
              const src = SOURCE[hit.docTypeId];
              // The engine carries the payers it found. Show them when the
              // reason string does not already name them, which is how the
              // rental line ends up carrying its address.
              const extra = hit.issuers.filter((n) => !hit.reason.includes(n)).join(', ');
              return (
                <li
                  key={hit.docTypeId}
                  data-in={step >= i}
                  className={cn(
                    'mk-row grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1 border-b border-line py-2 last:border-b-0',
                    'sm:grid-cols-[6.75rem_minmax(0,1fr)_4.5rem]',
                    !running && hovered && src?.key === hovered && 'bg-surface-sunken',
                  )}
                  onMouseEnter={() => setHovered(src?.key ?? null)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <span
                    className={cn(
                      'ticket order-1 font-medium',
                      PRIORITY_TONE[hit.priority] ?? 'text-ink-muted',
                    )}
                  >
                    {CODE[hit.docTypeId] ?? hit.docTypeId}
                    {hit.quantity > 1 ? (
                      <span className="text-ink-muted"> &times;{hit.quantity}</span>
                    ) : null}
                  </span>
                  <span className="ticket order-2 justify-self-end text-ink-muted sm:order-3">
                    {src ? src.cite : 'everyone'}
                  </span>
                  <span className="order-3 col-span-2 text-[0.8125rem] leading-[1.55] text-ink-muted sm:order-2 sm:col-span-1">
                    {hit.reason}
                    {extra ? <span className="text-ink-muted"> {extra}</span> : null}
                  </span>
                </li>
              );
            })}
          </ol>

          <p
            data-in={step >= HITS.length - 1}
            className="mk-row mt-5 border-t border-line pt-4 text-[0.8125rem] leading-[1.6] text-ink-muted sm:mt-7"
          >
            <span>
              {CITED} of those {HITS.length} point at a line on the return, and the other{' '}
              {UNIVERSAL} are asked of every client. What a checklist leaves out is the part a blank
              template can never get right.
            </span>
          </p>
        </div>
      </div>

      {/* Peak of the argument. The reader has just watched the thing work; the
          next line is what it would mean for them, and a way to do it. */}
      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-t border-line-strong pt-4">
        <p className="max-w-[46ch] text-pretty text-[0.9375rem] leading-[1.6] text-ink">
          Nobody at the firm wrote that list. A preparer only has to agree with it.
        </p>
        <Link
          to="/signup"
          className="mk-act -my-1 inline-flex shrink-0 items-baseline gap-2 rounded-sm py-1 text-[0.9375rem] font-medium text-ink"
        >
          <span className="mk-act-label">Point it at one of your own returns</span>
          <span aria-hidden className="mk-fee-mark text-[0.8125rem] leading-none">
            &rarr;
          </span>
        </Link>
      </div>
    </Section>
  );
}
