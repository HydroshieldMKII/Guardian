import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api";
import { errorMessage } from "@/lib/utils";
import type { UserDevice } from "@/types";

export function useDeviceNote(
  device: UserDevice,
  onDeviceUpdate?: (device: UserDevice) => void,
) {
  const { toast } = useToast();
  const [readAt, setReadAt] = useState(device.requestNoteReadAt);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setReadAt(device.requestNoteReadAt);
  }, [device.id, device.requestNoteReadAt]);

  const deleteNote = async () => {
    setDeleting(true);
    try {
      await apiClient.deleteDeviceNote(device.id);
      setReadAt(undefined);
      toast({
        title: "Note deleted",
        description: "The note this user left on the device is gone for good.",
        variant: "success",
      });
      onDeviceUpdate?.({
        ...device,
        requestDescription: undefined,
        requestSubmittedAt: undefined,
        requestNoteReadAt: undefined,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: errorMessage(error, "Failed to delete note"),
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  return { readAt, deleting, deleteNote };
}
