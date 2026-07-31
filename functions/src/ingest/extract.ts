/**
 * Text extraction for the ingestion pipeline.
 *
 * The classifier is only as good as the text it sees, so each format is read the
 * way that surfaces the form title cheaply:
 *   • PDF   — per-page text via unpdf, capped at the first 30 pages / 2 MB so a
 *             200-page brokerage package never blows the cold-start budget.
 *   • Image — text produced by the `storage-extract-image-text` extension
 *             (Cloud Vision), read back from Firestore. The extension runs on
 *             the same finalize event we do, so we wait briefly for it to land.
 *   • CSV / spreadsheet — the first 64 KB as text, plenty for the match patterns.
 *
 * Output text keeps newlines within a page (issuer extraction needs them) and
 * separates pages with a form-feed (the classifier uses it for page numbers).
 */

import { getDocumentProxy } from 'unpdf';
import { bucket, db } from '../lib/admin.ts';

/** Pages separated by form-feed; the classifier splits on this. */
const PAGE_SEP = '\f';
const MAX_PDF_PAGES = 30;
const MAX_TEXT_CHARS = 2_000_000;
const CSV_BYTES = 64 * 1024;

/**
 * Firestore collection the OCR extension writes to. Configurable so it can be
 * kept in lockstep with the `storage-extract-image-text` install (COLLECTION_PATH).
 */
const OCR_COLLECTION = process.env.OCR_TEXT_COLLECTION ?? 'ocrText';
/** How long to wait for the async OCR extension before falling back. */
const OCR_MAX_WAIT_MS = Number(process.env.OCR_MAX_WAIT_MS ?? 45_000);
/** The extension only handles JPEG/PNG; other image types can't be OCR'd here. */
const OCR_TYPES = new Set(['image/jpeg', 'image/png']);

export type ExtractionMethod = 'text' | 'ocr' | 'filename';

export interface ExtractionResult {
  /** Normalised, page-delimited text ready for the classifier. Empty if none. */
  text: string;
  /** Total pages in the source PDF (even when only the first 30 were read). */
  pageCount?: number;
  /** How the text was obtained — becomes the classification `method`. */
  method: ExtractionMethod;
}

export interface ExtractInput {
  /** Full Storage object name, e.g. `firms/f1/2025/c1/d1/IMG_4821.HEIC`. */
  objectName: string;
  contentType: string;
  fileName: string;
}

/** Collapses intra-line whitespace, keeps newlines, drops blank lines. */
function normalizePage(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t\u00a0\f\v]+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

function joinPages(pages: string[]): string {
  const normalised = pages.map(normalizePage).filter((p) => p.length > 0);
  const joined = normalised.join(PAGE_SEP);
  return joined.length > MAX_TEXT_CHARS ? joined.slice(0, MAX_TEXT_CHARS) : joined;
}

interface PdfTextItem {
  str: string;
  hasEOL: boolean;
}

/** Reads text from the first `MAX_PDF_PAGES` pages, preserving line breaks. */
async function extractPdf(data: Uint8Array): Promise<{ pages: string[]; pageCount: number }> {
  const pdf = await getDocumentProxy(data);
  const pageCount = pdf.numPages;
  const limit = Math.min(pageCount, MAX_PDF_PAGES);
  const pages: string[] = [];
  let chars = 0;

  for (let i = 1; i <= limit && chars < MAX_TEXT_CHARS; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let text = '';
    for (const item of content.items as Array<PdfTextItem | { type: string }>) {
      if (!('str' in item)) continue;
      text += item.str;
      text += item.hasEOL ? '\n' : ' ';
    }
    pages.push(text);
    chars += text.length;
  }
  return { pages, pageCount };
}

/** Reads only the first `maxBytes` of an object — enough for a CSV/export. */
async function readFirstBytes(objectName: string, maxBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  const stream = bucket.file(objectName).createReadStream({ start: 0, end: maxBytes - 1 });
  for await (const chunk of stream as AsyncIterable<Buffer>) {
    chunks.push(chunk);
    total += chunk.length;
    if (total >= maxBytes) break;
  }
  return Buffer.concat(chunks);
}

/** Decodes bytes to text, keeping only readable characters (drops binary noise). */
function decodeText(buf: Buffer): string {
  const text = buf.toString('utf8').replace(/[\u0000-\u0008\u000e-\u001f\u007f-\u009f]/g, ' ');
  const printable = text.replace(/[^\x20-\x7e\s]/g, '');
  // Mostly-binary payloads (a real .xlsx zip) yield little readable text — skip
  // them rather than feed the classifier noise.
  return printable.length >= 16 && printable.length / Math.max(text.length, 1) > 0.6 ? printable : '';
}

function pickOcrText(data: Record<string, unknown>): string {
  if (typeof data.text === 'string') return data.text;
  // DETAIL=full writes the raw Vision array instead; entry 0 is the whole page.
  const annotations = data.textAnnotations as { description?: unknown }[] | undefined;
  const first = annotations?.[0]?.description;
  return typeof first === 'string' ? first : '';
}

/**
 * The key the extension indexes its output under. It writes the *fully
 * qualified* object URI, not the bare object name we use everywhere else —
 * querying with the bare name silently matches nothing.
 */
export function ocrFileKey(bucketName: string, objectName: string): string {
  return `gs://${bucketName}/${objectName}`;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Reads OCR text for an object from the extension's output collection. The
 * extension runs asynchronously off the same upload event, so we poll briefly
 * with backoff and fall back cleanly if it never lands (or isn't installed).
 */
async function readOcrText(objectName: string, contentType: string): Promise<string> {
  if (!OCR_TYPES.has(contentType)) return '';
  const collection = db.collection(OCR_COLLECTION);
  const deadline = Date.now() + OCR_MAX_WAIT_MS;
  let delay = 1_000;
  for (;;) {
    try {
      const snap = await collection
        .where('file', '==', ocrFileKey(bucket.name, objectName))
        .limit(1)
        .get();
      if (!snap.empty) {
        const text = pickOcrText(snap.docs[0]!.data());
        if (text.trim().length > 0) return text;
      }
    } catch {
      // Collection missing / not installed — nothing to consume.
      return '';
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) return '';
    await sleep(Math.min(delay, remaining));
    delay = Math.min(delay * 1.5, 5_000);
  }
}

function isTextual(contentType: string, fileName: string): boolean {
  return (
    contentType === 'text/csv' ||
    contentType === 'text/plain' ||
    contentType === 'application/vnd.ms-excel' ||
    contentType.includes('spreadsheet') ||
    contentType.includes('wordprocessing') ||
    /\.(csv|txt|tsv)$/i.test(fileName)
  );
}

/** Extracts classifier-ready text from a freshly uploaded object. */
export async function extractDocument(input: ExtractInput): Promise<ExtractionResult> {
  const { objectName, contentType, fileName } = input;

  if (contentType === 'application/pdf' || /\.pdf$/i.test(fileName)) {
    const [buf] = await bucket.file(objectName).download();
    const { pages, pageCount } = await extractPdf(new Uint8Array(buf));
    const text = joinPages(pages);
    return { text, pageCount, method: text.length > 0 ? 'text' : 'filename' };
  }

  if (contentType.startsWith('image/')) {
    const ocr = await readOcrText(objectName, contentType);
    const text = joinPages([ocr]);
    return { text, method: text.length > 0 ? 'ocr' : 'filename' };
  }

  if (isTextual(contentType, fileName)) {
    const buf = await readFirstBytes(objectName, CSV_BYTES);
    const text = joinPages([decodeText(buf)]);
    return { text, method: text.length > 0 ? 'text' : 'filename' };
  }

  // Anything else (a stray binary) — let the filename be the only hint.
  return { text: '', method: 'filename' };
}
