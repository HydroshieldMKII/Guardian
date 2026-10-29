import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { errorMessage } from "@/lib/utils";
import type { UserDevice } from "@/types";

const EXCLUDED_MESSAGE =
  "Streams from this device no longer count towards the user's concurrent stream limit";
const INCLUDED_MESSAGE =
  "Streams from this device now count towards the user's concurrent stream limit";

export function useConcurrentLimitExclusion(
  device: UserDevice,
  onDeviceUpdate?: (device: UserDevice) => void,
) {
  const { toast } = useToast();
  const stored = device.excludeFromConcurrentLimit ?? false;
  const [excluded, setExcluded] = useState(stored);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setExcluded(stored);
  }, [device.id, stored]);

  const change = async (exclude: boolean) => {
    setSaving(true);
    try {
      await apiClient.updateDeviceExcludeFromConcurrentLimit(
        device.id,
        exclude,
      );
      setExcluded(exclude);
      toast({
        title: "Success",
        description: exclude ? EXCLUDED_MESSAGE : INCLUDED_MESSAGE,
        variant: "success",
      });
      onDeviceUpdate?.({ ...device, excludeFromConcurrentLimit: exclude });
    } catch (error) {
      toast({
        title: "Error",
        description: errorMessage(
          error,
          "Failed to update this device's settings",
        ),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return { excluded, saving, change };
}
