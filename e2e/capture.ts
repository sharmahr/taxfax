import type { Page } from '@playwright/test';

/** Every screenshot in the suite, taken the same way.
 *
 *  `animations: 'disabled'` fast-forwards finite animations to their settled
 *  state and cancels infinite ones before the shutter opens. Without it a
 *  capture races whatever is moving on screen, so a visual verdict — "is this
 *  surface better than TaxDome's?" — could turn on which millisecond the frame
 *  landed on rather than on the design. Screenshots are evidence; evidence that
 *  changes between identical runs isn't evidence. */
export function capture(page: Page, path: string) {
  return page.screenshot({ path, fullPage: true, animations: 'disabled' });
}
