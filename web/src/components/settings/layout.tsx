import type { ReactNode } from 'react';
import { useId } from 'react';
import { cn } from '@/lib/cn';
import { Switch } from '@/components/ui/Switch';

/** The title block at the top of every settings page. */
export function SettingsHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="display text-2xl text-ink sm:text-[1.75rem]">{title}</h2>
        {description ? (
          <p className="mt-1.5 max-w-prose text-pretty text-sm text-ink-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/**
 * A labelled group within a page. The heading is a plain sub-heading, not an
 * eyebrow over every block — the sections carry structure, the type stays quiet.
 */
export function SettingsSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn('border-t border-line pt-6', className)}>
      <div className="grid grid-cols-1 gap-x-10 gap-y-5 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
        <div className="min-w-0">
          <h3 id={id} className="text-sm font-semibold text-ink">
            {title}
          </h3>
          {description ? (
            <p className="mt-1.5 text-pretty text-2xs leading-relaxed text-ink-faint">
              {description}
            </p>
          ) : null}
        </div>
        <div className="min-w-0 space-y-5">{children}</div>
      </div>
    </section>
  );
}

/** A responsive two-up grid for related fields. Collapses to one column on phones. */
export function FieldGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2', className)}>{children}</div>;
}

/** A switch with a label and a plain-language consequence, wired for screen readers. */
export function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled = false,
}: {
  label: ReactNode;
  description: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const descId = `${id}-desc`;
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        <p id={descId} className="mt-0.5 text-pretty text-2xs leading-relaxed text-ink-faint">
          {description}
        </p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={descId}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}
