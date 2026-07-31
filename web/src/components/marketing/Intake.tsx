import { Fragment } from 'react';
import { Link } from '@tanstack/react-router';
import { renderSms } from '@taxfax/shared';
import { RequestStatusPill } from '@/components/ui/StatusPill';
import { Note, Section, SectionHead } from './Section';

const SMS = renderSms('firm', {
  clientFirstName: 'Eleanor',
  firmName: 'Halloran & Reyes',
  preparerName: 'Dana Osei',
  outstanding: [
    'W-2 (Cascade School District)',
    'Consolidated 1099 (Vanguard)',
    'Rental income and expenses (44 Alder St)',
  ],
  outstandingCount: 3,
  totalCount: 15,
  portalUrl: 'tfx.link/8FQ2K1',
  daysWaiting: 11,
  daysToDeadline: 30,
  signature: 'Dana Osei',
});

/**
 * The canonical name `packages/shared/src/naming.ts` produces for this upload,
 * split at the joins so each part can say what it is for.
 */
const SEGMENTS: { text: string; note: string }[] = [
  { text: 'WhitfieldE', note: 'Surname first, then the initial, so the drawer sorts itself' },
  { text: '2025', note: 'The year it belongs to, not the year it arrived' },
  { text: 'W2', note: 'What the page turned out to be' },
  { text: 'RiverbendHealth', note: 'Who issued it, taken off the form' },
];

export function Intake() {
  return (
    <Section id="intake" label="The taxpayer">
      <SectionHead title="No account. No password. Nothing to log into.">
        A 58-year-old with a shoebox of paper will not create an account, and every hour your staff
        spend resetting one is an hour the return does not move. So there is no account. The text
        has the link, the link is the list, and the camera is the upload.
      </SectionHead>

      <div className="mt-10 grid gap-x-14 gap-y-12 lg:grid-cols-[minmax(0,17.5rem)_minmax(0,1fr)]">
        <div>
          <p className="mk-eyebrow text-ink-muted">What she receives</p>
          <blockquote className="mt-3 border-l-2 border-line-strong pl-4 text-[0.9375rem] leading-[1.62] text-ink">
            {SMS}
          </blockquote>
          <p className="mt-4 text-[0.8125rem] leading-[1.6] text-ink-muted">
            That link is the whole login. It opens on the phone she is already holding, to her list
            and a camera button, and nothing else.
          </p>
          <p className="mt-4 text-[0.8125rem] leading-[1.6] text-ink-muted">
            The STOP line is there because the law requires it. It is also the fastest way to find
            out that a number in your client file has been wrong since 2019.
          </p>

          <p className="mk-eyebrow mt-8 border-t border-line pt-6 text-ink-muted">
            The obvious objection
          </p>
          <p className="mt-3 text-[0.8125rem] leading-[1.6] text-ink-muted">
            No password is not the same as no lock. The link signs her in once, against the email
            address on her file, and a device that has not seen it before is asked for that address
            first. What it opens is one client&rsquo;s folder at one firm. It cannot list a second
            one, and it stops working after it is used.
          </p>
        </div>

        <figure className="min-w-0">
          <figcaption className="mk-eyebrow text-ink-muted">What you get back</figcaption>

          <p className="mt-4 font-mono text-[0.875rem] leading-none text-ink-muted">
            IMG_4021.HEIC
            <span className="ml-3 font-sans text-[0.75rem]">2.4 MB, off the camera roll</span>
          </p>

          <p className="my-3 flex items-center gap-3 text-[0.75rem] leading-none text-ink-muted">
            <span aria-hidden="true" className="ml-[0.35rem] h-8 w-px shrink-0 bg-line-strong" />
            read, classified, and matched to the request it answers
          </p>

          <p className="font-mono text-[clamp(0.9375rem,2.4vw,1.375rem)] leading-[1.35] text-ink">
            {SEGMENTS.map((s, i) => (
              <Fragment key={s.text}>
                {i > 0 ? <wbr /> : null}
                <span className="whitespace-nowrap">
                  {i > 0 ? <span className="text-ink-muted">_</span> : null}
                  {s.text}
                </span>
              </Fragment>
            ))}
            <span className="text-ink-muted">.heic</span>
          </p>

          <dl className="mt-6 border-t border-line">
            {SEGMENTS.map((s) => (
              <div
                key={s.text}
                className="grid gap-x-6 border-b border-line py-2.5 sm:grid-cols-[10rem_minmax(0,1fr)]"
              >
                <dt className="font-mono text-[0.75rem] leading-[1.6] text-ink">{s.text}</dt>
                <dd className="text-[0.8125rem] leading-[1.6] text-ink-muted">{s.note}</dd>
              </div>
            ))}
            <div className="grid gap-x-6 border-b border-line py-2.5 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <dt className="font-mono text-[0.75rem] leading-[1.6] text-ink-muted">.heic</dt>
              <dd className="text-[0.8125rem] leading-[1.6] text-ink-muted">
                Left exactly as taken. Nothing is re-encoded on the way in.
              </dd>
            </div>
            <div className="grid items-baseline gap-x-6 gap-y-2 border-b-[3px] border-double border-ink pb-3 pt-4 sm:grid-cols-[10rem_minmax(0,1fr)]">
              <dt className="text-2xs uppercase tracking-[0.06em] text-ink-muted">Answers</dt>
              <dd className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="text-[0.8125rem] leading-[1.5] text-ink">
                  W-2 (Riverbend Health)
                </span>
                <RequestStatusPill status="received" />
              </dd>
            </div>
          </dl>

          <Note className="mt-4">
            Nobody typed that name and nobody dragged it into a folder. The one request it answers
            closes on its own, and the chase for that request stops with it.
          </Note>
        </figure>
      </div>

      {/* The third proof closes the loop, so this is where the argument is
          finished and the reader is either in or not. */}
      <div className="mt-10 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-t border-line-strong pt-4">
        <p className="max-w-[46ch] text-pretty text-[0.9375rem] leading-[1.6] text-ink">
          Derived, asked for, answered and filed. Your staff appears nowhere in that sentence.
        </p>
        <Link
          to="/signup"
          className="mk-act -my-1 inline-flex shrink-0 items-baseline gap-2 rounded-sm py-1 text-[0.9375rem] font-medium text-ink"
        >
          <span className="mk-act-label">Start a season</span>
          <span aria-hidden className="mk-fee-mark text-[0.8125rem] leading-none">
            &rarr;
          </span>
        </Link>
      </div>
    </Section>
  );
}
