"use client";

import { useProtectedActions } from "@/hooks/settings/useProtectedActions";
import { BackupCard } from "./admin-tools/BackupCard";
import { ProtectedActionModals } from "./admin-tools/ProtectedActionModals";
import { ProtectedActionsCard } from "./admin-tools/ProtectedActionsCard";
import {
  DANGER_ACTIONS,
  MAINTENANCE_ACTIONS,
} from "./admin-tools/protected-actions";

interface AdminToolsProps {
  onSettingsRefresh?: () => void;
}

export function AdminTools({ onSettingsRefresh }: AdminToolsProps) {
  const flow = useProtectedActions(onSettingsRefresh);

  return (
    <>
      <ProtectedActionsCard
        title="Maintenance"
        description="Routine clean-up that leaves your devices and users in place."
        actions={MAINTENANCE_ACTIONS}
        busy={flow.busy}
        onStart={flow.confirm}
      />
      <BackupCard onSettingsRefresh={onSettingsRefresh} />
      <ProtectedActionsCard
        danger
        title="Dangerous operations"
        description="Nothing here can be undone."
        actions={DANGER_ACTIONS}
        busy={flow.busy}
        onStart={flow.confirm}
      />
      <ProtectedActionModals
        actions={[...MAINTENANCE_ACTIONS, ...DANGER_ACTIONS]}
        flow={flow}
      />
    </>
  );
}
