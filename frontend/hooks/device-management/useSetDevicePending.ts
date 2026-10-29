import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { errorMessage } from "@/lib/utils";
import type { UserDevice } from "@/types";

const FAILED = "Failed to set device to pending";

export function useSetDevicePending({
  device,
  onSetPending,
  onDeviceUpdate,
  onDone,
}: {
  device: UserDevice;
  onSetPending?: (deviceId: number) => Promise<boolean>;
  onDeviceUpdate?: (device: UserDevice) => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const failed = (description: string) =>
    toast({ title: "Error", description, variant: "destructive" });

  const setPending = async () => {
    if (!onSetPending) return;

    setSaving(true);
    try {
      if (!(await onSetPending(device.id))) {
        failed(FAILED);
        return;
      }
      toast({
        title: "Device set to pending",
        description:
          "This device is waiting for approval again and follows this user's New devices rule until you decide.",
        variant: "success",
      });
      onDeviceUpdate?.({ ...device, status: "pending" });
      onDone();
    } catch (error) {
      failed(errorMessage(error, FAILED));
    } finally {
      setSaving(false);
    }
  };

  return { saving, setPending };
}
