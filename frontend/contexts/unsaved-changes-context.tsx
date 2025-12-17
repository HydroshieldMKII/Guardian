"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

interface UnsavedChangesContextType {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (value: boolean) => void;
  pendingNavigation: string | null;
  setPendingNavigation: (path: string | null) => void;
  showUnsavedWarning: boolean;
  setShowUnsavedWarning: (value: boolean) => void;
  onSaveAndLeave: (() => Promise<void>) | null;
  setOnSaveAndLeave: (fn: (() => Promise<void>) | null) => void;
  onDiscardChanges: (() => void) | null;
  setOnDiscardChanges: (fn: (() => void) | null) => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextType | undefined>(undefined);

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [onSaveAndLeave, setOnSaveAndLeaveState] = useState<(() => Promise<void>) | null>(null);
  const [onDiscardChanges, setOnDiscardChangesState] = useState<(() => void) | null>(null);

  const setOnSaveAndLeave = useCallback((fn: (() => Promise<void>) | null) => {
    setOnSaveAndLeaveState(() => fn);
  }, []);

  const setOnDiscardChanges = useCallback((fn: (() => void) | null) => {
    setOnDiscardChangesState(() => fn);
  }, []);

  return (
    <UnsavedChangesContext.Provider
      value={{
        hasUnsavedChanges,
        setHasUnsavedChanges,
        pendingNavigation,
        setPendingNavigation,
        showUnsavedWarning,
        setShowUnsavedWarning,
        onSaveAndLeave,
        setOnSaveAndLeave,
        onDiscardChanges,
        setOnDiscardChanges,
      }}
    >
      {children}
    </UnsavedChangesContext.Provider>
  );
}

export function useUnsavedChanges() {
  const context = useContext(UnsavedChangesContext);
  if (context === undefined) {
    throw new Error("useUnsavedChanges must be used within an UnsavedChangesProvider");
  }
  return context;
}
