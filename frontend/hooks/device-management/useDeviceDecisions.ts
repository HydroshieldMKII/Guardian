"use client";

import { useState } from "react";
import type {
  ConfirmAction,
  ConfirmActionData,
} from "@/components/device-management/ConfirmationModal";
import { useDeviceActions } from "@/hooks/device-management/useDeviceActions";
import { useToast } from "@/hooks/use-toast";
import { formatMinutes } from "@/lib/duration";
import type { UserDevice } from "@/types";

const REFRESH_DELAY_MS = 100;

const CONFIRM_COPY = {
  approve: {
    title: "Approve device",
    description: "This device will be able to stream from your Plex server.",
  },
  reject: {
    title: "Reject device",
    description:
      "This device will be blocked from streaming from your Plex server.",
  },
  removeTemporaryAccess: {
    title: "Remove temporary access",
    description:
      "The grant ends now instead of when it was due to expire. This device goes straight back under the user's usual policies, so it stops streaming if they block it.",
  },
  delete: {
    title: "Delete device",
    description:
      "The record is removed for good. The device reappears as pending the next time it connects, and follows this user's New devices rule until then.",
  },
};

const SUCCESS = {
  approve: {
    title: "Device approved",
    description: "This device can now stream from your Plex server",
  },
  reject: {
    title: "Device rejected",
    description: "This device is now blocked from streaming",
  },
  delete: {
    title: "Device deleted",
    description:
      "The record is gone. The device reappears as pending the next time it connects.",
  },
  removeTemporaryAccess: {
    title: "Temporary access removed",
    description:
      "The grant ended early. This device is back under the user's usual policies.",
  },
};

const copyFor = (action: ConfirmAction, device: UserDevice) =>
  CONFIRM_COPY[
    action === "toggle"
      ? device.status === "approved"
        ? "reject"
        : "approve"
      : action
  ];

interface DeviceDecisionCallbacks {
  refresh: () => Promise<void>;
  onPendingSet: () => void;
  onRenamed: (deviceId: number, newName: string) => void;
  onAccessGranted: () => void;
}

export function useDeviceDecisions({
  refresh,
  onPendingSet,
  onRenamed,
  onAccessGranted,
}: DeviceDecisionCallbacks) {
  const deviceActions = useDeviceActions();
  const { toast } = useToast();
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmActionData | null>(
    null,
  );

  const refreshSoon = () => setTimeout(() => void refresh(), REFRESH_DELAY_MS);

  const decide = async (
    deviceId: number,
    request: (deviceId: number) => Promise<boolean>,
    success: { title: string; description: string },
  ) => {
    try {
      setActionLoading(deviceId);
      if (await request(deviceId)) {
        refreshSoon();
        toast({ ...success, variant: "success" });
      }
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const approve = (deviceId: number) =>
    decide(deviceId, deviceActions.approveDevice, SUCCESS.approve);
  const reject = (deviceId: number) =>
    decide(deviceId, deviceActions.rejectDevice, SUCCESS.reject);

  const run = {
    approve: (device: UserDevice) => approve(device.id),
    reject: (device: UserDevice) => reject(device.id),
    delete: (device: UserDevice) =>
      decide(device.id, deviceActions.deleteDevice, SUCCESS.delete),
    toggle: (device: UserDevice) =>
      device.status === "approved" ? reject(device.id) : approve(device.id),
    removeTemporaryAccess: (device: UserDevice) =>
      decide(
        device.id,
        deviceActions.revokeTemporaryAccess,
        SUCCESS.removeTemporaryAccess,
      ),
  } satisfies Record<ConfirmAction, (device: UserDevice) => Promise<void>>;

  const askToConfirm = (action: ConfirmAction) => (device: UserDevice) =>
    setConfirmAction({ device, action, ...copyFor(action, device) });

  const runConfirmedAction = async () => {
    if (!confirmAction) return;
    await run[confirmAction.action](confirmAction.device);
  };

  const setPending = async (deviceId: number): Promise<boolean> => {
    try {
      setActionLoading(deviceId);
      const success = await deviceActions.setPendingDevice(deviceId);
      if (success) {
        refreshSoon();
        toast({
          title: "Device set to pending",
          description:
            "This device follows this user's New devices rule until you approve or reject it",
          variant: "success",
        });
        onPendingSet();
      }
      return success;
    } finally {
      setActionLoading(null);
    }
  };

  const rename = async (deviceId: number, newName: string) => {
    try {
      setActionLoading(deviceId);
      if (await deviceActions.renameDevice(deviceId, newName)) {
        onRenamed(deviceId, newName);
        refreshSoon();
      }
    } finally {
      setActionLoading(null);
    }
  };

  const grantTemporaryAccess = async (
    deviceIds: number[],
    durationMinutes: number,
    bypassPolicies?: boolean,
  ) => {
    try {
      setActionLoading(deviceIds[0]);
      if (deviceIds.length === 1) {
        const success = await deviceActions.grantTemporaryAccess(
          deviceIds[0],
          durationMinutes,
          bypassPolicies,
        );
        if (!success) {
          toast({
            title: "Error",
            description: "Failed to grant temporary access",
            variant: "destructive",
          });
          return;
        }
      } else {
        const result = await deviceActions.grantBatchTemporaryAccess(
          deviceIds,
          durationMinutes,
          bypassPolicies,
        );
        if (!result.success) {
          toast({
            title: "Error",
            description: "Failed to grant temporary access to these devices",
            variant: "destructive",
          });
          return;
        }

        const batchResults = result.results as
          { success: boolean }[] | undefined;
        const failedDevices = batchResults?.filter((r) => !r.success) || [];
        if (failedDevices.length > 0) {
          toast({
            title: "Some devices were not granted access",
            description: `${deviceIds.length - failedDevices.length} of ${deviceIds.length} devices were granted temporary access. Try the remaining ${failedDevices.length} again.`,
            variant: "destructive",
          });
        }
      }

      refreshSoon();
      onAccessGranted();
      toast({
        title: "Temporary access granted",
        description: `Temporary access granted to ${deviceIds.length} device${deviceIds.length > 1 ? "s" : ""} for ${formatMinutes(durationMinutes)}`,
        variant: "success",
      });
    } finally {
      setActionLoading(null);
    }
  };

  return {
    actionLoading,
    confirmAction,
    cancelConfirmation: () => setConfirmAction(null),
    confirmApprove: askToConfirm("approve"),
    confirmReject: askToConfirm("reject"),
    confirmDelete: askToConfirm("delete"),
    confirmToggle: askToConfirm("toggle"),
    confirmRemoveTemporaryAccess: askToConfirm("removeTemporaryAccess"),
    runConfirmedAction,
    setPending,
    rename,
    grantTemporaryAccess,
  };
}
