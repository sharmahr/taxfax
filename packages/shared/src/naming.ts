/**
 * Canonical filenames.
 *
 * A phone photo called `IMG_4821.HEIC` becomes `Whitfield_2025_W2_AcmeCorp.pdf`.
 * The format is chosen so a folder of them sorts usefully in Finder, Explorer,
 * and every tax package a firm might drag them into.
 */

import { docType } from './taxonomy.ts';

/** ASCII, PascalCase-ish, safe on every filesystem and in every email client. */
export function slugify(input: string, maxLen = 28): string {
  const cleaned = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'And')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  return cleaned.slice(0, maxLen) || 'Unknown';
}

/** Surname for individuals, entity name otherwise — the leading sort token. */
export function clientToken(displayName: string): string {
  const trimmed = displayName.trim();
  if (/\b(llc|inc|corp|ltd|lp|llp|plc|co|trust|foundation|partners)\b/i.test(trimmed)) {
    return slugify(trimmed, 24);
  }
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return slugify(trimmed, 24);
  const last = parts[parts.length - 1];
  const first = parts[0];
  return slugify(`${last}${first.charAt(0)}`, 24);
}

const EXT_BY_TYPE: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/webp': 'webp',
  'image/tiff': 'tif',
  'text/csv': 'csv',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

/**
 * The extension the *bytes* deserve, not the one the filename claims.
 *
 * `contentType` wins whenever we recognise it, because the two genuinely
 * disagree after a transcode: the portal re-encodes HEIC to JPEG in the
 * browser, and trusting `w2-photo.heic` there would canonicalise JPEG bytes to
 * `.heic` — a file the taxpayer's own OS refuses to open, and one that can slip
 * past OCR forever because nothing downstream looks inside it.
 *
 * The filename is only a fallback, for the uncommon types browsers hand us as
 * `application/octet-stream`.
 */
export function extensionFor(originalName: string, contentType: string): string {
  const known = EXT_BY_TYPE[contentType];
  if (known) return known;
  const fromName = originalName.includes('.')
    ? originalName.split('.').pop()!.toLowerCase().replace(/[^a-z0-9]/g, '')
    : '';
  if (fromName && fromName.length <= 5) return fromName;
  return 'bin';
}

export interface CanonicalNameInput {
  clientDisplayName: string;
  taxYear: number;
  docTypeId: string;
  issuer?: string;
  originalName: string;
  contentType: string;
  /** 1-based; suffixed only when > 1, so the common case stays clean. */
  sequence?: number;
}

export function canonicalName(input: CanonicalNameInput): string {
  const parts = [
    clientToken(input.clientDisplayName),
    String(input.taxYear),
    docType(input.docTypeId).slug,
  ];
  if (input.issuer) {
    const issuer = slugify(input.issuer, 22);
    if (issuer && issuer !== 'Unknown') parts.push(issuer);
  }
  if (input.sequence && input.sequence > 1) parts.push(String(input.sequence).padStart(2, '0'));
  return `${parts.join('_')}.${extensionFor(input.originalName, input.contentType)}`;
}

// ── Storage layout ──────────────────────────────────────────────────────────

/**
 * `firms/{firmId}/{taxYear}/{clientId}/{documentId}/{canonicalOrOriginalName}`
 *
 * The documentId segment means a re-classification can rewrite the filename
 * without ever colliding, and Storage rules only need the first two segments.
 */
export function documentPath(
  firmId: string,
  taxYear: number,
  clientId: string,
  documentId: string,
  fileName: string,
): string {
  return `firms/${firmId}/${taxYear}/${clientId}/${documentId}/${fileName}`;
}

export function firmAssetPath(firmId: string, fileName: string): string {
  return `firms/${firmId}/assets/${fileName}`;
}

/** Pulls the tenancy segments back out of a Storage path. */
export function parseDocumentPath(path: string): {
  firmId: string;
  taxYear: number;
  clientId: string;
  documentId: string;
  fileName: string;
} | null {
  const m = /^firms\/([^/]+)\/(\d{4})\/([^/]+)\/([^/]+)\/(.+)$/.exec(path);
  if (!m) return null;
  return {
    firmId: m[1],
    taxYear: Number(m[2]),
    clientId: m[3],
    documentId: m[4],
    fileName: m[5],
  };
}

export const MAX_UPLOAD_BYTES = 40 * 1024 * 1024;

export const ACCEPTED_UPLOAD_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'image/tiff',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

export function isAcceptedUpload(contentType: string): boolean {
  return ACCEPTED_UPLOAD_TYPES.includes(contentType);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
