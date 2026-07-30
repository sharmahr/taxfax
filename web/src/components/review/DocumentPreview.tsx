import { useEffect, useState } from 'react';
import { getDownloadURL, ref } from 'firebase/storage';
import { FileWarning, ImageOff } from 'lucide-react';
import { formatBytes } from '@taxfax/shared';
import { storage } from '@/lib/firebase';
import { Skeleton } from '@/components/ui';
import type { QueueItem } from './useReviewQueue';

type Status = 'loading' | 'ready' | 'error';

/** Shows the actual page. Falls back gracefully when the object is missing or
 *  the browser can't render the type (e.g. a phone's HEIC). */
export function DocumentPreview({ doc }: { doc: QueueItem }) {
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  const isPdf = doc.contentType === 'application/pdf';
  const isImage = doc.contentType.startsWith('image/');
  const browserRenderable = isPdf || (isImage && !/hei[cf]$/i.test(doc.contentType));

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setUrl(null);
    if (!browserRenderable) {
      setStatus('error');
      return;
    }
    getDownloadURL(ref(storage, doc.storagePath))
      .then((u) => {
        if (!cancelled) {
          setUrl(u);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [doc.storagePath, browserRenderable]);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="relative flex-1 overflow-hidden rounded-xl border border-line bg-surface-sunken">
        {status === 'loading' && <Skeleton className="absolute inset-3 rounded-lg" />}

        {status === 'ready' && url && isImage && (
          <div className="grid h-full w-full place-items-center overflow-auto p-4">
            <img
              src={url}
              alt={`Page 1 of ${doc.originalName}`}
              className="max-h-full w-auto rounded-md bg-white shadow-md ring-1 ring-black/5"
            />
          </div>
        )}

        {status === 'ready' && url && isPdf && (
          <iframe title={doc.originalName} src={`${url}#toolbar=0&view=FitH`} className="h-full w-full bg-white" />
        )}

        {status === 'error' && <UnavailablePreview doc={doc} unsupported={!browserRenderable} />}

        <span className="absolute right-2 top-2 rounded-md bg-ink/80 px-1.5 py-0.5 font-mono text-2xs text-paper backdrop-blur-sm">
          {doc.pageCount && doc.pageCount > 1 ? `${doc.pageCount} pages` : '1 page'}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3 px-1">
        <p className="ticket truncate text-ink-muted" title={doc.originalName}>
          {doc.originalName}
        </p>
        <p className="shrink-0 font-mono text-2xs tabular-nums text-ink-faint">{formatBytes(doc.sizeBytes)}</p>
      </div>
    </div>
  );
}

function UnavailablePreview({ doc, unsupported }: { doc: QueueItem; unsupported: boolean }) {
  const Icon = unsupported ? ImageOff : FileWarning;
  return (
    <div className="grid h-full w-full place-items-center p-6 text-center">
      <div className="max-w-xs">
        <span className="mx-auto mb-3 grid size-12 place-items-center rounded-xl bg-surface text-ink-faint ring-1 ring-inset ring-line">
          <Icon className="size-5" />
        </span>
        <p className="text-sm font-medium text-ink">
          {unsupported ? 'No in-browser preview for this format' : 'Preview not available'}
        </p>
        <p className="mt-1 text-[13px] text-ink-muted">
          {unsupported
            ? `${doc.originalName.split('.').pop()?.toUpperCase() ?? 'This file'} can't render here. Decide from the classifier evidence, or open the original.`
            : 'The stored file couldn’t be loaded. You can still decide from the evidence below.'}
        </p>
      </div>
    </div>
  );
}
