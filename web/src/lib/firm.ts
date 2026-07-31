import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

export interface CreateFirmInput {
  name: string;
  timezone: string;
  taxYear: number;
}

export interface CreateFirmResult {
  firmId: string;
}

/** Calls the `createFirm` callable. Throws with a `functions/*` code the UI maps to English. */
export async function createFirm(input: CreateFirmInput): Promise<CreateFirmResult> {
  const callable = httpsCallable<CreateFirmInput, CreateFirmResult>(functions, 'createFirm');
  const res = await callable(input);
  return res.data;
}

/** Redeems an invite token for the signed-in user. */
export async function acceptInvite(token: string): Promise<{ firmId: string }> {
  const callable = httpsCallable<{ token: string }, { firmId: string }>(functions, 'acceptInvite');
  const res = await callable({ token });
  return res.data;
}

export {
  FIRM_TIMEZONES,
  FALLBACK_TIMEZONE,
  isFirmTimezone,
  resolveFirmTimezone,
  defaultTimezone,
  type ResolvedTimezone,
} from './timezone';

/** Jan–Apr files last year's return; the rest of the year preps the current one. */
export function defaultTaxYear(now = new Date()): number {
  return now.getMonth() <= 3 ? now.getFullYear() - 1 : now.getFullYear();
}
