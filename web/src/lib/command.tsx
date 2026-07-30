import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';

/**
 * The command registry. Surfaces built by other agents contribute palette
 * entries with `useCommand({ group, label, run })`; the palette in the shell
 * reads them back through `useCommandRegistry`.
 */
export interface CommandDef {
  /** Stable across renders — used for dedupe and recents. */
  id: string;
  group: string;
  label: string;
  /** Extra tokens folded into fuzzy matching (client emails, aliases…). */
  keywords?: string[];
  shortcut?: string[];
  icon?: ComponentType<{ className?: string }>;
  run: () => void;
  /** Higher sorts first within a group. */
  priority?: number;
}

interface Registry {
  register: (cmd: CommandDef) => () => void;
  commands: CommandDef[];
}

const CommandContext = createContext<Registry | null>(null);

export function CommandProvider({ children }: { children: ReactNode }): ReactNode {
  const [commands, setCommands] = useState<CommandDef[]>([]);

  const register = useCallback((cmd: CommandDef) => {
    setCommands((prev) => [...prev.filter((c) => c.id !== cmd.id), cmd]);
    return () => setCommands((prev) => prev.filter((c) => c.id !== cmd.id));
  }, []);

  const value = useMemo(() => ({ register, commands }), [register, commands]);
  return <CommandContext.Provider value={value}>{children}</CommandContext.Provider>;
}

export function useCommandRegistry(): Registry {
  const ctx = useContext(CommandContext);
  if (!ctx) throw new Error('Command hooks must be used within <CommandProvider>.');
  return ctx;
}

/**
 * Register one command for as long as the calling component is mounted. `run`
 * always calls the latest closure, so it may safely close over current props.
 */
export function useCommand(cmd: CommandDef): void {
  const { register } = useCommandRegistry();
  const latest = useRef(cmd);
  latest.current = cmd;

  // Re-register only when identity or display changes, never on every render.
  useEffect(
    () => register({ ...latest.current, run: () => latest.current.run() }),
    [register, cmd.id, cmd.group, cmd.label],
  );
}

// ── Recents ──────────────────────────────────────────────────────────────────
// Persisted jump-back targets (mostly clients). Stored as plain data so they
// survive reloads; the palette turns them back into navigations.

export interface RecentEntry {
  id: string;
  label: string;
  to: string;
}

const RECENTS_KEY = 'taxfax.recents';
const RECENTS_MAX = 6;

export function getRecents(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as RecentEntry[]) : [];
  } catch {
    return [];
  }
}

export function pushRecent(entry: RecentEntry): void {
  const next = [entry, ...getRecents().filter((e) => e.id !== entry.id)].slice(0, RECENTS_MAX);
  localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
}
