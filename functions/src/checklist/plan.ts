/**
 * Pure checklist planning — the "what should we ask this client for" decision,
 * with no Firestore in sight. Kept firebase-free (and importing shared by
 * relative path) so it runs in the fast, emulator-free CI tier and so the
 * confidence-fallback boundary is pinned by parse.test.ts.
 *
 * Materialising the plan into DocRequest documents is the side-effectful half
 * and lives in generate.ts; this module only decides.
 */
import {
  STARTER_CHECKLIST,
  generateChecklist as buildChecklist,
  type PriorYearReturn,
  type RequestPriority,
} from '../../../packages/shared/src/index.ts';

/**
 * Below this parse confidence we don't trust the extraction enough to ask a
 * client for specific documents. Asking for a K-1 they don't have — or worse,
 * failing to ask for one they do — is how this product loses a firm's trust, so
 * a weak parse degrades to the generic starter list rather than a confidently
 * wrong personalised one.
 */
export const MIN_CONFIDENCE = 0.15;

export interface MaterialItem {
  docTypeId: string;
  reason: string;
  priority: RequestPriority;
  quantity: number;
  issuers: string[];
}

export type ChecklistSource = 'prior_year' | 'starter';

export interface ChecklistPlan {
  source: ChecklistSource;
  items: MaterialItem[];
}

function personalised(prior: PriorYearReturn): MaterialItem[] {
  return buildChecklist({ prior, taxYear: prior.taxYear + 1 }).map((h) => ({
    docTypeId: h.docTypeId,
    reason: h.reason,
    priority: h.priority,
    quantity: h.quantity,
    issuers: h.issuers,
  }));
}

function starter(): MaterialItem[] {
  return STARTER_CHECKLIST.map((s) => ({
    docTypeId: s.docTypeId,
    reason: s.reason,
    priority: s.priority,
    quantity: 1,
    issuers: [],
  }));
}

/**
 * Trust a confident parse and personalise the checklist, or fall back to the
 * starter list. This is the single authority for that decision — both the
 * upload trigger and the on-demand regenerate route through it.
 */
export function planChecklist(prior: PriorYearReturn): ChecklistPlan {
  return prior.confidence >= MIN_CONFIDENCE
    ? { source: 'prior_year', items: personalised(prior) }
    : { source: 'starter', items: starter() };
}
