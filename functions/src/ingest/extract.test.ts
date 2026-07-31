/**
 * The contract with the `storage-extract-image-text` extension.
 *
 *   node --experimental-strip-types --test functions/src/ingest/extract.test.ts
 *
 * This is the one seam in the pipeline nothing else can reach. The extension
 * only runs in a real Firebase project — the emulator never starts it, and the
 * E2E suite uploads PDFs, which take the `unpdf` path — so the handshake between
 * what it writes and what we read has no other coverage.
 *
 * It shipped broken in two independent ways: it wrote `extractedText` while we
 * read `ocrText`, and it indexes on a fully-qualified `gs://` URI while we
 * queried the bare object name. Either one alone is fatal, and both fail
 * *silently* — a missing OCR document is indistinguishable from a photo with no
 * text in it, so every image would have degraded to filename-only
 * classification, which `classify.ts` caps below the auto-accept bar. The whole
 * phone-camera path would have gone to manual review forever, with no error
 * anywhere. Hence assertions rather than trust.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ocrFileKey } from './extract.ts';

const SRC = new URL('./extract.ts', import.meta.url);
const ENV = new URL('../../../extensions/storage-extract-image-text.env', import.meta.url);

describe('storage-extract-image-text contract', () => {
  /*
   * googlecloud/storage-extract-image-text@0.1.9 — functions/src/index.ts:
   *   const filePath = `gs://${object.bucket}/${object.name}`;
   *   await admin.firestore().collection(config.collectionPath)
   *     .add({ file: filePath, text: extractedText });
   */
  it('keys on the fully-qualified gs:// URI, not the bare object name', () => {
    assert.equal(
      ocrFileKey('taxfax-364f6.firebasestorage.app', 'firms/f1/2025/c1/d1/IMG_4821.jpg'),
      'gs://taxfax-364f6.firebasestorage.app/firms/f1/2025/c1/d1/IMG_4821.jpg',
    );
  });

  it('builds the lookup through that helper instead of inlining a key', async () => {
    const src = await readFile(SRC, 'utf8');
    assert.match(
      src,
      /\.where\('file', '==', ocrFileKey\(bucket\.name, objectName\)\)/,
      'readOcrText must query the extension key, not the bare object name',
    );
  });

  it('reads the same collection the installed extension writes', async () => {
    const configured = /^COLLECTION_PATH=(.+)$/m.exec(await readFile(ENV, 'utf8'))?.[1]?.trim();
    const read = /OCR_TEXT_COLLECTION \?\? '([^']+)'/.exec(await readFile(SRC, 'utf8'))?.[1];

    assert.ok(configured, 'COLLECTION_PATH missing from the extension env');
    assert.equal(
      configured,
      read,
      `extension writes "${configured}" but ingest reads "${read}" — OCR would never be found`,
    );
  });
});
