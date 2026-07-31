import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Every section is a ruled band with a metadata gutter, the way a schedule
 * carries its heading in the left margin. The gutter label is sticky on
 * desktop so you always know which part of the argument you are in.
 */
export function Section({
  id,
  label,
  children,
  className,
}: {
  id: string;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cn('scroll-mt-16 border-t border-line', className)}>
      <div className="mx-auto w-full max-w-[76rem] px-5 sm:px-8">
        <div className="grid gap-y-6 py-16 md:grid-cols-[7.5rem_minmax(0,1fr)] md:gap-x-10 md:py-24 lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-x-16">
          <div className="md:sticky md:top-24 md:self-start">
            <p className="mk-eyebrow text-ink-muted">{label}</p>
          </div>
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </section>
  );
}

/** Heading plus at most one paragraph. Anything more belongs in the artifact. */
export function SectionHead({
  title,
  children,
  className,
}: {
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn('max-w-[46rem]', className)}>
      <h2 className="display mk-hang text-pretty text-[clamp(1.75rem,4.2vw,2.6rem)] text-ink">
        {title}
      </h2>
      {children ? (
        <p className="mt-4 max-w-[62ch] text-pretty text-[0.9375rem] leading-[1.68] text-ink-muted">
          {children}
        </p>
      ) : null}
    </header>
  );
}

/** A figure caption, or the small print under an artifact. */
export function Note({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn('max-w-[68ch] text-pretty text-[0.8125rem] leading-[1.6] text-ink-muted', className)}>
      {children}
    </p>
  );
}
