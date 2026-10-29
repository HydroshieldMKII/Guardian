import { LogOut, MonitorSmartphone, User } from "lucide-react";
import type { Action } from "@/components/ui/action-menu";
import type { PlexSession } from "@/types";

export interface StreamNavigation {
  onNavigateToDevice?: (userId: string, deviceIdentifier: string) => void;
  onNavigateToUser?: (userId: string) => void;
}

export const streamTargets = (stream: PlexSession) => {
  const userId = stream.User?.id;
  const deviceIdentifier = stream.Player?.machineIdentifier;
  return {
    userId,
    deviceIdentifier: userId ? deviceIdentifier : undefined,
  };
};

export function navigationActions(
  stream: PlexSession,
  { onNavigateToDevice, onNavigateToUser }: StreamNavigation,
): Action[] {
  const { userId, deviceIdentifier } = streamTargets(stream);

  return [
    {
      label: "Go to user",
      icon: User,
      disabled: !userId,
      onSelect: () => userId && onNavigateToUser?.(userId),
    },
    {
      label: "Go to device",
      icon: MonitorSmartphone,
      disabled: !deviceIdentifier,
      onSelect: () =>
        userId &&
        deviceIdentifier &&
        onNavigateToDevice?.(userId, deviceIdentifier),
    },
  ];
}

export function removeAccessAction(
  stream: PlexSession,
  isRevoking: boolean,
  onRemoveAccess: () => void,
): Action | undefined {
  if (stream.Player?.product === "Plexamp") return undefined;
  return {
    label: "Remove access",
    icon: LogOut,
    tone: "danger",
    disabled: !streamTargets(stream).deviceIdentifier || isRevoking,
    onSelect: onRemoveAccess,
  };
}
