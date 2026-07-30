import {
  cloneElement,
  isValidElement,
  useId,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/cn';
import { Label } from './Label';

interface FieldProps extends Omit<ComponentProps<'div'>, 'children'> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** A single form control. Its id, `aria-describedby` and `aria-invalid` are wired for you. */
  children: ReactElement<{
    id?: string;
    'aria-describedby'?: string;
    'aria-invalid'?: boolean;
  }>;
}

/** Label + control + hint/error, wired for screen readers. Error replaces hint when present. */
export function Field({ label, hint, error, required, className, children, ...props }: FieldProps) {
  const autoId = useId();
  const id = children.props.id ?? autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [children.props['aria-describedby'], error ? errorId : hintId]
    .filter(Boolean)
    .join(' ');

  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-describedby': describedBy || undefined,
        'aria-invalid': error ? true : children.props['aria-invalid'],
      })
    : children;

  return (
    <div className={cn('flex flex-col gap-1.5', className)} {...props}>
      {label ? (
        <Label htmlFor={id}>
          {label}
          {required ? <span className="text-stamp-ink"> *</span> : null}
        </Label>
      ) : null}
      {control}
      {error ? (
        <p id={errorId} className="text-2xs text-status-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-2xs text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
