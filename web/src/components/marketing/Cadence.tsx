import { useState } from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import {
  cadenceCompression,
  CHASE_PROFILES,
  DEFAULT_CHASE_SETTINGS,
  renderEmail,
  renderSms,
  TONE_LABEL,
  type ChaseCopyInput,
} from '@taxfax/shared';
import { cn } from '@/lib/cn';
import { Section, SectionHead } from './Section';

const STEPS = CHASE_PROFILES.standard.steps;

/** The filing deadline the copy counts down to, so the page is honest in March. */
function daysToFilingDeadline(): number {
  const now = new Date();
  const thisYear = new Date(now.getFullYear(), 3, 15);
  const target = thisYear >= now ? thisYear : new Date(now.getFullYear() + 1, 3, 15);
  return Math.max(1, Math.round((target.getTime() - now.getTime()) / 86_400_000));
}

const BASE: ChaseCopyInput = {
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
  daysWaiting: 0,
  daysToDeadline: daysToFilingDeadline(),
  signature: 'Dana Osei\nHalloran & Reyes CPAs',
};

const pct = (days: number) => `${Math.round(cadenceCompression(days) * 100)}%`;
const hh = (h: number) => `${String(h).padStart(2, '0')}:00`;

export function Cadence() {
  const [value, setValue] = useState('2');

  return (
    <Section id="chase" label="The chase">
      <SectionHead title="The follow-up nobody on your staff has to write.">
        One request, five messages, twenty-six days. Escalating means shorter and more specific, not
        louder, because the message that actually gets a document back names the exact missing item
        and gives one link. Read any of them.
      </SectionHead>

      <TabsPrimitive.Root
        value={value}
        onValueChange={setValue}
        orientation="vertical"
        className="mt-10 grid gap-px border border-line bg-line lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)]"
      >
        <TabsPrimitive.List
          aria-label="Chase steps"
          className="flex flex-col bg-surface-sunken px-4 py-4 sm:px-5"
        >
          <p className="mk-eyebrow text-ink-muted pb-2">Standard cadence</p>
          {STEPS.map((s, i) => (
            <TabsPrimitive.Trigger
              key={s.index}
              value={String(i)}
              className={cn(
                'group -mx-2 grid grid-cols-[3.25rem_minmax(0,1fr)] items-baseline gap-x-3 gap-y-0.5',
                'cursor-pointer border-b border-line px-2 py-2.5 text-left outline-hidden',
                'transition-colors duration-100 ease-out-quint hover:bg-surface',
                'data-[state=active]:bg-surface',
                'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus',
              )}
            >
              <span className="ticket text-ink-muted group-data-[state=active]:text-stamp">
                Day {s.dayOffset}
              </span>
              <span className="text-[0.8125rem] font-medium text-ink-muted group-data-[state=active]:text-ink">
                {TONE_LABEL[s.tone]}
              </span>
              <span />
              <span className="text-2xs text-ink-muted">
                {s.channels.includes('sms') ? 'Email and text' : 'Email'}
                {s.notifyStaff ? ', flags your staff' : ''}
              </span>
            </TabsPrimitive.Trigger>
          ))}

          <div className="mt-6 pt-4">
            <p className="mk-eyebrow text-ink-muted">Sending rules</p>
            <dl className="mt-2.5 space-y-2 text-[0.75rem] leading-[1.55] text-ink-muted">
              {[
                [
                  'Window',
                  `${hh(DEFAULT_CHASE_SETTINGS.quietHours.end)}\u2013${hh(DEFAULT_CHASE_SETTINGS.quietHours.start)} on weekdays, measured in the client\u2019s timezone rather than yours.`,
                ],
                [
                  'Compression',
                  `Intervals shrink to ${pct(30)} of the gap inside a month of April 15, and ${pct(7)} inside a week.`,
                ],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="inline font-medium text-ink-muted">{k}. </dt>
                  <dd className="inline">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </TabsPrimitive.List>

        <div className="min-w-0 bg-surface px-4 py-5 sm:px-6">
          {STEPS.map((s, i) => {
            const copy = { ...BASE, daysWaiting: s.dayOffset };
            const message = renderEmail(s.tone, copy);
            // The text message is shown where it reads true out of season. The
            // urgent variant counts the days left to April 15, which is only
            // meaningful inside one.
            const sms = s.tone === 'firm' || s.tone === 'final' ? renderSms(s.tone, copy) : null;
            return (
              <TabsPrimitive.Content
                key={s.index}
                value={String(i)}
                className="mk-swap flex min-h-full flex-col outline-hidden"
              >
                <p className="mk-eyebrow text-ink-muted">Subject</p>
                <p className="mt-1 text-pretty text-[0.9375rem] font-medium leading-snug text-ink">
                  {message.subject}
                </p>
                <pre className="mt-5 overflow-x-auto whitespace-pre-wrap border-t border-line pt-4 font-mono text-[0.6875rem] leading-[1.75] text-ink-muted sm:text-[0.78125rem]">
                  {message.body}
                </pre>

                <div className="mt-auto pt-8">
                  {sms ? (
                    <div className="border-t border-line pt-4">
                      <p className="mk-eyebrow text-ink-muted">Text message, same day</p>
                      <p className="mt-2 max-w-[62ch] font-mono text-[0.6875rem] leading-[1.7] text-ink-muted">
                        {sms}
                      </p>
                    </div>
                  ) : null}
                  <p className="mt-4 border-t border-line pt-3 text-[0.75rem] leading-[1.55] text-ink-muted">
                    Your preparer reads this before it goes. One reply from Eleanor stops the
                    sequence, and the moment a document arrives the chase for that document stops.
                  </p>
                </div>
              </TabsPrimitive.Content>
            );
          })}
        </div>
      </TabsPrimitive.Root>
    </Section>
  );
}
