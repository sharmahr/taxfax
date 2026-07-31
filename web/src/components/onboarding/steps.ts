import type { Firm } from '@taxfax/shared';

/**
 * The first-run checklist. Order is the recommended path, but nothing here traps
 * the user: every step can be skipped and returned to, and the workspace is
 * fully usable after any one of them. `id`s are what land in
 * `firm.onboarding.completedSteps`.
 */
export const ONBOARDING_STEPS = [
  {
    id: 'profile',
    title: 'Set up your firm',
    short: 'Firm',
    blurb: 'The name, timezone, and reply-to that clients see on every message.',
  },
  {
    id: 'import',
    title: 'Import your clients',
    short: 'Clients',
    blurb: "Bring last season's roster in from a CSV — we'll map the columns for you.",
  },
  {
    id: 'priorYear',
    title: 'See a checklist build itself',
    short: 'Checklist',
    blurb: "Watch a prior-year return turn into this year's document list.",
  },
  {
    id: 'team',
    title: 'Invite your team',
    short: 'Team',
    blurb: 'Add colleagues and set what each of them can do.',
  },
  {
    id: 'cadence',
    title: 'Tune the chase',
    short: 'Chase',
    blurb: 'How hard TaxFax nudges, and the hours it stays quiet.',
  },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]['id'];

export interface OnboardingProgress {
  done: Set<string>;
  completed: number;
  total: number;
  complete: boolean;
  nextIndex: number;
}

export function onboardingProgress(firm: Pick<Firm, 'onboarding'> | null | undefined): OnboardingProgress {
  const done = new Set(firm?.onboarding?.completedSteps ?? []);
  const total = ONBOARDING_STEPS.length;
  const completed = ONBOARDING_STEPS.filter((s) => done.has(s.id)).length;
  const nextIndex = ONBOARDING_STEPS.findIndex((s) => !done.has(s.id));
  return {
    done,
    completed,
    total,
    complete: completed >= total,
    nextIndex: nextIndex === -1 ? total - 1 : nextIndex,
  };
}
