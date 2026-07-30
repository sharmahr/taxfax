import type { CSSProperties } from 'react';
import { Toaster as Sonner, toast } from 'sonner';
import { useTheme } from '@/lib/theme';

/** sonner, dressed in the design tokens and synced to the active theme. */
export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme}
      position="bottom-right"
      gap={10}
      offset={16}
      toastOptions={{
        classNames: {
          toast: 'rounded-xl border border-line bg-surface-raised text-ink shadow-lg',
          title: 'text-sm font-medium',
          description: '!text-ink-muted text-sm',
          actionButton: 'rounded-md bg-ink text-paper text-xs font-medium',
          cancelButton: 'rounded-md bg-surface-sunken text-ink-muted text-xs font-medium',
          icon: 'text-ink-muted',
          error: '!text-status-danger',
          success: '!text-status-success',
          warning: '!text-status-warn',
          info: '!text-status-info',
        },
      }}
      style={
        {
          '--normal-bg': 'var(--color-surface-raised)',
          '--normal-border': 'var(--color-line)',
          '--normal-text': 'var(--color-ink)',
          '--border-radius': 'var(--radius-xl)',
        } as CSSProperties
      }
    />
  );
}

export { toast };
