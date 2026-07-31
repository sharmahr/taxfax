/**
 * Chase engine — public surface.
 *
 * The root `functions/src/index.ts` re-exports this barrel, so every Cloud
 * Function the chase subsystem ships lives here:
 *
 *   Scheduled   runChaseSweep          every 15 min, drives the cadence
 *   Callable    startChase             begin chasing one client
 *               startChaseBulk         season kickoff (dry-run by default)
 *               pauseChase / resumeChase
 *               sendChaseNow           fire the current step by hand
 *               previewChase           exact rendered email + SMS, no send
 *               optOutSms              portal-facing TCPA opt-out
 *               setChaseLanguage       taxpayer or preparer picks the language
 *   Firestore   onChecklistComplete    stop the instant a client is done
 *               handleSmsOptOut        inbound STOP/START → Contact.smsOptOut
 *               mirrorEmailDelivery    mail delivery state → ChaseMessage
 *               mirrorSmsDelivery      sms delivery state → ChaseMessage
 */

export { runChaseSweep } from './scheduler.js';

export {
  startChase,
  startChaseBulk,
  pauseChase,
  resumeChase,
  sendChaseNow,
  previewChase,
  onChecklistComplete,
  handleSmsOptOut,
  optOutSms,
  setChaseLanguage,
} from './lifecycle.js';

export { mirrorEmailDelivery, mirrorSmsDelivery } from './delivery.js';

