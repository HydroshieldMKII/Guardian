import { useState } from "react";
import type { UserDevice } from "@/types";

export function useDeviceRename() {
  const [editingDevice, setEditingDevice] = useState<number | null>(null);
  const [newDeviceName, setNewDeviceName] = useState("");

  const startEditing = (device: UserDevice) => {
    setEditingDevice(device.id);
    setNewDeviceName(device.deviceName || "");
  };

  const cancelEditing = () => {
    setEditingDevice(null);
    setNewDeviceName("");
  };

  return {
    editingDevice,
    newDeviceName,
    setNewDeviceName,
    startEditing,
    cancelEditing,
  };
}
