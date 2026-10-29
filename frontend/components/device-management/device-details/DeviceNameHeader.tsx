import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModalHeader } from "@/components/ui/modal";
import type { UserDevice } from "@/types";
import { Spinner } from "./Spinner";

export const MAX_DEVICE_NAME_LENGTH = 100;

export function DeviceNameHeader({
  device,
  renaming,
  busy,
  newName,
  onNameChange,
  onEdit,
  onRename,
  onCancel,
}: {
  device: UserDevice;
  renaming: boolean;
  busy: boolean;
  newName: string;
  onNameChange: (name: string) => void;
  onEdit: () => void;
  onRename: () => void;
  onCancel: () => void;
}) {
  const trimmedName = newName.trim();
  const canSave =
    trimmedName.length > 0 &&
    trimmedName.length <= MAX_DEVICE_NAME_LENGTH &&
    !busy;

  return (
    <ModalHeader
      title={device.deviceName || "Unknown"}
      titleHidden={renaming}
      titleSuffix={
        renaming ? (
          <>
            <Input
              value={newName}
              onChange={(e) => onNameChange(e.target.value)}
              className="h-8 min-w-40 flex-1"
              placeholder="Device name"
              aria-label="Device name"
              maxLength={MAX_DEVICE_NAME_LENGTH}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSave) {
                  e.preventDefault();
                  onRename();
                }
              }}
              autoFocus
            />
            <Button size="sm" onClick={onRename} disabled={!canSave}>
              {busy ? <Spinner /> : "Save"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onCancel}
              disabled={busy}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            aria-label="Rename"
            className="size-7 shrink-0 px-0 text-muted-foreground"
          >
            <Pencil className="size-3.5" />
          </Button>
        )
      }
    />
  );
}
