import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'villagestock-sidebar-collapsed';

function readStoredCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

type SidebarLayoutContextValue = {
  collapsed: boolean;
  setCollapsed: (next: boolean) => void;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  setMobileOpen: (next: boolean) => void;
  closeMobile: () => void;
};

const SidebarLayoutContext = createContext<SidebarLayoutContextValue | null>(null);

export function SidebarLayoutProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsedState] = useState(() =>
    typeof window !== 'undefined' ? readStoredCollapsed() : false
  );

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsedState((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const [mobileOpen, setMobileOpenState] = useState(false);
  const setMobileOpen = useCallback((next: boolean) => setMobileOpenState(next), []);
  const closeMobile = useCallback(() => setMobileOpenState(false), []);

  return (
    <SidebarLayoutContext.Provider
      value={{ collapsed, setCollapsed, toggleCollapsed, mobileOpen, setMobileOpen, closeMobile }}
    >
      {children}
    </SidebarLayoutContext.Provider>
  );
}

export function useSidebarLayout() {
  const ctx = useContext(SidebarLayoutContext);
  if (!ctx) {
    throw new Error('useSidebarLayout must be used within SidebarLayoutProvider');
  }
  return ctx;
}
