"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

export type DashboardView = "streams" | "users";

export interface DashboardNavState {
  view: DashboardView | null;
  pendingDevices: number;
  activeStreams: number;
}

interface DashboardNavContextValue extends DashboardNavState {
  publish: (state: DashboardNavState) => void;
}

const EMPTY: DashboardNavState = {
  view: null,
  pendingDevices: 0,
  activeStreams: 0,
};

const DashboardNavContext = createContext<DashboardNavContextValue>({
  ...EMPTY,
  publish: () => {},
});

export function DashboardNavProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<DashboardNavState>(EMPTY);

  const publish = useCallback(
    (next: DashboardNavState) =>
      setState((current) =>
        current.view === next.view &&
        current.pendingDevices === next.pendingDevices &&
        current.activeStreams === next.activeStreams
          ? current
          : next,
      ),
    [],
  );

  const value = useMemo(() => ({ ...state, publish }), [state, publish]);

  return (
    <DashboardNavContext.Provider value={value}>
      {children}
    </DashboardNavContext.Provider>
  );
}

export function useDashboardNav() {
  return useContext(DashboardNavContext);
}

export function dashboardHref(view: DashboardView) {
  return `/?view=${view}`;
}
