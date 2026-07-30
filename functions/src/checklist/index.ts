/**
 * Checklist engine — public surface. Every export here is a deployable Cloud
 * Function; the parser, merge, and rollup internals stay module-private and are
 * reached only through these triggers and callables.
 */
export {
  generateChecklist,
  addRequest,
  waiveRequest,
  reorderRequests,
  onPriorYearReturnUploaded,
} from './generate.js';
export { onRequestWritten, markOverdue } from './progress.js';
export { saveChecklistTemplate, applyTemplate } from './templates.js';
