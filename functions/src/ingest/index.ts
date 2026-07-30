/**
 * Ingestion pipeline barrel. Re-exports the deployable functions so the
 * top-level `functions/src/index.ts` picks them up with a single wildcard.
 *
 *   onDocumentUploaded  — Storage trigger: extract → classify → rename → link
 *   requestUploadSlot   — callable: hand the client a safe upload path
 *   reclassifyDocument  — callable: a preparer corrects the type
 *   acceptDocument      — callable: a preparer signs off
 *   rejectDocument      — callable: a preparer asks for a re-send
 */
export {
  onDocumentUploaded,
  requestUploadSlot,
  reclassifyDocument,
  acceptDocument,
  rejectDocument,
} from './pipeline.js';
