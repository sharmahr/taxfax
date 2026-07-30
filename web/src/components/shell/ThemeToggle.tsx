import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type Theme } from '@/lib/theme';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';

const NEXT: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' };
const ICON: Record<Theme, typeof Sun> = { system: Monitor, light: Sun, dark: Moon };
const LABEL: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark' };

/** Cycles system → light → dark. All three stay reachable from one control. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const Icon = ICON[theme];
  return (
    <Tooltip content={`Theme: ${LABEL[theme]}`}>
      <Button
        iconOnly
        size="sm"
        variant="ghost"
        aria-label={`Theme: ${LABEL[theme]}. Switch to ${LABEL[NEXT[theme]]}.`}
        onClick={() => setTheme(NEXT[theme])}
      >
        <Icon />
      </Button>
    </Tooltip>
  );
}
