import { useSyncExternalStore } from 'react';

/**
 * Theme control. The source of truth is the same `taxfax.theme` key the inline
 * script in index.html reads before first paint, so light/dark never flashes:
 *
 *   'dark' | 'light'  → an explicit choice
 *   (absent)          → follow the operating system
 */
export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const KEY = 'taxfax.theme';

function systemPrefersDark(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
}

function readTheme(): Theme {
  const stored = localStorage.getItem(KEY);
  return stored === 'dark' || stored === 'light' ? stored : 'system';
}

function resolve(theme: Theme): ResolvedTheme {
  if (theme === 'system') return systemPrefersDark() ? 'dark' : 'light';
  return theme;
}

// A single cached snapshot so useSyncExternalStore stays referentially stable.
let state: { theme: Theme; resolved: ResolvedTheme } = (() => {
  const theme = readTheme();
  return { theme, resolved: resolve(theme) };
})();

const listeners = new Set<() => void>();

function apply(resolved: ResolvedTheme): void {
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

function commit(theme: Theme): void {
  state = { theme, resolved: resolve(theme) };
  apply(state.resolved);
  for (const l of listeners) l();
}

export function setTheme(theme: Theme): void {
  if (theme === 'system') localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, theme);
  commit(theme);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Follow the OS while in system mode, and reconcile changes from other tabs.
if (typeof matchMedia !== 'undefined') {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.theme === 'system') commit('system');
  });
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) commit(readTheme());
  });
}

export function useTheme(): {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
} {
  const snap = useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
  return { theme: snap.theme, resolvedTheme: snap.resolved, setTheme };
}
