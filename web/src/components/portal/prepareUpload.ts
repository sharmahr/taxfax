import { isAcceptedUpload, formatBytes, MAX_UPLOAD_BYTES } from '@taxfax/shared';

/**
 * Turns whatever a taxpayer hands us into something the ingest pipeline can
 * actually read — before a single byte hits the network.
 *
 * The one hard job here is HEIC. iPhones photograph in HEIC by default, but the
 * server-side OCR extension only reads JPEG/PNG, so a raw HEIC upload would OCR
 * to nothing and sit in `needs_review` forever. Safari/WebKit can decode HEIC
 * natively through `createImageBitmap`, so we transcode to JPEG on-device with a
 * canvas — no library, no WASM, nothing extra on the wire for an old phone.
 */

export interface PreparedFile {
  blob: Blob;
  /** Name to upload under; a transcoded photo becomes `<name>.jpg`. */
  fileName: string;
  contentType: string;
  sizeBytes: number;
  /** True when we converted a HEIC photo to JPEG in the browser. */
  transcoded: boolean;
  /** What the taxpayer's device called it, for display + the record. */
  originalName: string;
}

/** A failure the taxpayer can act on — always phrased as a next step. */
export class UploadPrepError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadPrepError';
  }
}

const HEIC_MIME = /^image\/(heic|heif)$/i;
const HEIC_EXT = /\.(heic|heif)$/i;

/** Longest edge we keep. A W-2 photo is legible far below the 12MP a phone
 * shoots, and a ~2600px JPEG uploads in seconds on hotel wifi. */
const MAX_EDGE = 2600;
const JPEG_QUALITY = 0.85;

function isHeic(file: File): boolean {
  return HEIC_MIME.test(file.type) || (HEIC_EXT.test(file.name) && !/^image\/(jpe?g|png)$/i.test(file.type));
}

function stripExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  return base.trim() || 'photo';
}

function guessType(name: string): string {
  switch (name.toLowerCase().split('.').pop()) {
    case 'pdf':
      return 'application/pdf';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'tif':
    case 'tiff':
      return 'image/tiff';
    case 'csv':
      return 'text/csv';
    case 'heic':
      return 'image/heic';
    case 'heif':
      return 'image/heif';
    default:
      return '';
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
}

async function transcodeHeic(file: File): Promise<PreparedFile> {
  const originalName = file.name || 'photo.heic';
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new UploadPrepError(
      "We couldn't read that photo on this device. Try taking it again, or upload a PDF.",
    );
  }
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new UploadPrepError("We couldn't process that photo. Try a PDF instead.");
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await canvasToJpeg(canvas);
    if (!blob || blob.size <= 0) {
      throw new UploadPrepError("We couldn't process that photo. Try a PDF instead.");
    }
    if (blob.size > MAX_UPLOAD_BYTES) {
      throw new UploadPrepError(`That photo is too large — the limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`);
    }
    return {
      blob,
      fileName: `${stripExtension(originalName)}.jpg`,
      contentType: 'image/jpeg',
      sizeBytes: blob.size,
      transcoded: true,
      originalName,
    };
  } finally {
    bitmap.close();
  }
}

/**
 * Prepare a single file for upload. Transcodes HEIC; validates everything else
 * up front so the taxpayer learns a file is too big or the wrong type *before*
 * any upload begins, not after a wasted minute on a slow connection.
 */
export async function prepareUpload(file: File): Promise<PreparedFile> {
  if (isHeic(file)) return transcodeHeic(file);

  const originalName = file.name || 'upload';
  const contentType = file.type || guessType(originalName);

  if (!isAcceptedUpload(contentType)) {
    throw new UploadPrepError("That kind of file isn't supported. Take a photo, or upload a PDF.");
  }
  if (file.size <= 0) {
    throw new UploadPrepError('That file looks empty. Try another.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadPrepError(`That file is too large — the limit is ${formatBytes(MAX_UPLOAD_BYTES)}.`);
  }

  return {
    blob: file,
    fileName: originalName,
    contentType,
    sizeBytes: file.size,
    transcoded: false,
    originalName,
  };
}
