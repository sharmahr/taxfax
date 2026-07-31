import { useRef, useState, type ReactNode } from 'react';
import { Camera, Paperclip, UploadCloud } from 'lucide-react';
import { UPLOAD_ACCEPT_ATTR } from '@taxfax/shared';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/Button';
import { usePortalLocale } from './locale';

/**
 * The one control the whole product hinges on. On a phone it opens the camera
 * first — because most taxpayers are holding a paper form — with a quieter path
 * to the photo library or a PDF. On a desktop it becomes a drop target.
 *
 * Real <button>s trigger hidden inputs (not label-wrapped inputs), so keyboard
 * focus stays visible and the accessible name is the button's own text.
 */

interface UploaderProps {
  onFiles: (files: File[]) => void;
  /** Coarse pointer → phone/tablet: lead with the camera. */
  coarse: boolean;
  /** Names the picked documents for a screen reader: "Add your W-2". */
  label: string;
  size?: 'md' | 'lg';
  className?: string;
}

export function Uploader({ onFiles, coarse, label, size = 'md', className }: UploaderProps) {
  const { t } = usePortalLocale();
  const cameraRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function take(list: FileList | null) {
    if (list && list.length) onFiles(Array.from(list));
  }

  const hiddenInputs = (
    <>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          take(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={filesRef}
        type="file"
        accept={UPLOAD_ACCEPT_ATTR}
        multiple
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(e) => {
          take(e.target.files);
          e.target.value = '';
        }}
      />
    </>
  );

  if (coarse) {
    return (
      <div className={cn('flex flex-col gap-2', className)}>
        <Button
          variant="primary"
          size={size === 'lg' ? 'md' : size}
          className={cn(size === 'lg' && 'h-11 px-5 text-[0.9375rem]')}
          onClick={() => cameraRef.current?.click()}
        >
          <Camera className="size-4" aria-hidden />
          {t('portal.upload')}
        </Button>
        <button
          type="button"
          onClick={() => filesRef.current?.click()}
          className="inline-flex items-center justify-center gap-1.5 rounded-md py-1 text-sm text-ink-muted underline-offset-4 transition-colors hover:text-ink hover:underline"
        >
          <Paperclip className="size-3.5" aria-hidden />
          {t('upload.chooseFiles')}
        </button>
        <span className="sr-only">{label}</span>
        {hiddenInputs}
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        take(e.dataTransfer.files);
      }}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-5 py-6 text-center transition-colors',
        dragging ? 'border-stamp/50 bg-stamp-wash' : 'border-line-strong bg-surface-sunken/40',
        className,
      )}
    >
      <UploadCloud
        className={cn('size-5 transition-colors', dragging ? 'text-stamp-ink' : 'text-ink-faint')}
        aria-hidden
      />
      <p className="text-sm text-ink-muted">
        {t('upload.dropPrompt', { format: 'PDF' })}{' '}
        <button
          type="button"
          onClick={() => filesRef.current?.click()}
          className="font-medium text-ink underline underline-offset-4 hover:text-stamp-ink"
        >
          {t('upload.chooseFile')}
        </button>
      </p>
      <span className="sr-only">{label}</span>
      {hiddenInputs}
    </div>
  );
}

/** Shared framing for one uploaded/in-flight line so every state aligns. */
export function UploadLine({
  icon,
  children,
  tone = 'default',
}: {
  icon: ReactNode;
  children: ReactNode;
  tone?: 'default' | 'danger' | 'success';
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors',
        tone === 'danger' && 'border-status-danger/25 bg-status-danger-wash',
        tone === 'success' && 'border-status-success/25 bg-status-success-wash',
        tone === 'default' && 'border-line bg-surface',
      )}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
