import React from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import {
  useTemporaryAccessForm,
  type GrantAccess,
} from "@/hooks/device-management/useTemporaryAccessForm";
import { UserDevice } from "@/types";
import { AccessDurationSection } from "./temporary-access/AccessDurationSection";
import { DeviceSelection } from "./temporary-access/DeviceSelection";
import { PolicyBypassSection } from "./temporary-access/PolicyBypassSection";

interface TemporaryAccessModalProps {
  user: {
    userId: string;
    username?: string;
  } | null;
  userDevices: UserDevice[];
  isOpen: boolean;
  onClose: () => void;
  onGrantAccess: GrantAccess;
  actionLoading: number | null;
  canGrantTemporaryAccess: (device: UserDevice) => boolean;
}

export const TemporaryAccessModal: React.FC<TemporaryAccessModalProps> = ({
  user,
  userDevices,
  isOpen,
  onClose,
  onGrantAccess,
  actionLoading,
  canGrantTemporaryAccess,
}) => {
  const eligibleDevices = userDevices.filter((device) =>
    canGrantTemporaryAccess(device),
  );
  const form = useTemporaryAccessForm(isOpen, eligibleDevices);

  if (!user) return null;

  const hasSelection = form.selectedDeviceIds.length > 0;

  return (
    <Modal open={isOpen} onOpenChange={onClose} size="lg">
      <ModalHeader
        title="Temporary access"
        description={
          <>
            Grant temporary streaming access to{" "}
            <span className="font-medium text-foreground">
              {user.username || user.userId}
            </span>
            &apos;s devices.
          </>
        }
      />

      <ModalBody className="space-y-8">
        <DeviceSelection
          devices={eligibleDevices}
          selectedIds={form.selectedDeviceIds}
          allSelected={form.allSelected}
          onToggle={form.toggleDevice}
          onToggleAll={form.toggleAll}
        />
        {hasSelection && <AccessDurationSection form={form} />}
        {hasSelection && (
          <PolicyBypassSection
            checked={form.bypassPolicies}
            onCheckedChange={form.setBypassPolicies}
          />
        )}
      </ModalBody>

      <ModalFooter>
        <Button
          variant="outline"
          onClick={onClose}
          disabled={actionLoading !== null}
        >
          Cancel
        </Button>
        <Button
          onClick={() => form.grant(onGrantAccess)}
          disabled={
            actionLoading !== null ||
            !hasSelection ||
            !form.durationValid ||
            !form.expiry
          }
        >
          {actionLoading ? (
            <>
              <RefreshCw className="size-4 animate-spin" />
              Granting Access...
            </>
          ) : (
            "Grant access"
          )}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
