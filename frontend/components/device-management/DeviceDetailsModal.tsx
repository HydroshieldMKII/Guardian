import React from "react";
import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { UserDevice, AppSetting } from "@/types";
import { isPlexampDevice, type PolicyBadge } from "@/lib/device-policies";
import { useConcurrentLimitExclusion } from "@/hooks/device-management/useConcurrentLimitExclusion";
import { useDeviceNote } from "@/hooks/device-management/useDeviceNote";
import { useSetDevicePending } from "@/hooks/device-management/useSetDevicePending";
import { DeviceNameHeader } from "./device-details/DeviceNameHeader";
import { DeviceOverview } from "./device-details/DeviceOverview";
import { DeviceSettingsSection } from "./device-details/DeviceSettingsSection";
import {
  hasTemporaryAccessHistory,
  TemporaryAccessSection,
} from "./device-details/TemporaryAccessSection";
import { UserNoteSection } from "./device-details/UserNoteSection";

interface DeviceDetailsModalProps {
  device: UserDevice | null;
  isOpen: boolean;
  onClose: () => void;
  editingDevice: number | null;
  newDeviceName: string;
  actionLoading: number | null;
  onEdit: (device: UserDevice) => void;
  onCancelEdit: () => void;
  onRename: (deviceId: number, newName: string) => void;
  onNewDeviceNameChange: (name: string) => void;
  onDeviceUpdate?: (device: UserDevice) => void;
  onSetPending?: (deviceId: number) => Promise<boolean>;
  settingsData?: AppSetting[];
  policies?: PolicyBadge[];
}

const isStrictMode = (settings?: AppSetting[]) =>
  settings?.find((setting) => setting.key === "PLEX_GUARD_STRICT_MODE")
    ?.value === "true";

export const DeviceDetailsModal: React.FC<DeviceDetailsModalProps> = ({
  device,
  ...props
}) => (device ? <DeviceDetails device={device} {...props} /> : null);

function DeviceDetails({
  device,
  isOpen,
  onClose,
  editingDevice,
  newDeviceName,
  actionLoading,
  onEdit,
  onCancelEdit,
  onRename,
  onNewDeviceNameChange,
  onDeviceUpdate,
  onSetPending,
  settingsData,
  policies = [],
}: DeviceDetailsModalProps & { device: UserDevice }) {
  const renaming = editingDevice === device.id;
  const handleClose = () => {
    if (renaming) {
      onCancelEdit();
    }
    onClose();
  };

  const cancelRenameOnEscape = (event: KeyboardEvent) => {
    if (!renaming) return;
    event.preventDefault();
    onCancelEdit();
  };

  const note = useDeviceNote(device, onDeviceUpdate);
  const exclusion = useConcurrentLimitExclusion(device, onDeviceUpdate);
  const pending = useSetDevicePending({
    device,
    onSetPending,
    onDeviceUpdate,
    onDone: handleClose,
  });

  return (
    <Modal
      open={isOpen}
      onOpenChange={handleClose}
      onEscapeKeyDown={cancelRenameOnEscape}
      size="lg"
      focusDialogOnOpen
    >
      <DeviceNameHeader
        device={device}
        renaming={renaming}
        busy={actionLoading === device.id}
        newName={newDeviceName}
        onNameChange={onNewDeviceNameChange}
        onEdit={() => onEdit(device)}
        onRename={() => onRename(device.id, newDeviceName)}
        onCancel={onCancelEdit}
      />

      <ModalBody>
        <DeviceOverview device={device} policies={policies} />

        {device.requestDescription &&
          device.requestSubmittedAt &&
          note.readAt && (
            <UserNoteSection
              description={device.requestDescription}
              submittedAt={device.requestSubmittedAt}
              readAt={note.readAt}
              deleting={note.deleting}
              onDelete={() => void note.deleteNote()}
            />
          )}

        {hasTemporaryAccessHistory(device) && (
          <TemporaryAccessSection device={device} />
        )}

        <DeviceSettingsSection
          plexamp={isPlexampDevice(device)}
          excluded={exclusion.excluded}
          savingExclusion={exclusion.saving}
          onExcludedChange={(exclude) => void exclusion.change(exclude)}
          canSetPending={device.status !== "pending" && Boolean(onSetPending)}
          strictMode={isStrictMode(settingsData)}
          savingPending={pending.saving}
          onSetPending={() => void pending.setPending()}
        />
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={handleClose}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
}
