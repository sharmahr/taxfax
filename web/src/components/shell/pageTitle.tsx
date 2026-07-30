import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

/**
 * The topbar title slot. Any page can claim it with `usePageTitle(...)`; the
 * topbar falls back to the current section name when no page sets one.
 */
const PageTitleContext = createContext<{
  node: ReactNode;
  setNode: (node: ReactNode) => void;
} | null>(null);

export function PageTitleProvider({ children }: { children: ReactNode }) {
  const [node, setNode] = useState<ReactNode>(null);
  return (
    <PageTitleContext.Provider value={{ node, setNode }}>{children}</PageTitleContext.Provider>
  );
}

export function usePageTitleNode(): ReactNode {
  return useContext(PageTitleContext)?.node ?? null;
}

/** Set the topbar title for as long as the calling page is mounted. */
export function usePageTitle(node: ReactNode): void {
  const ctx = useContext(PageTitleContext);
  useEffect(() => {
    ctx?.setNode(node);
    return () => ctx?.setNode(null);
  }, [ctx, node]);
}
