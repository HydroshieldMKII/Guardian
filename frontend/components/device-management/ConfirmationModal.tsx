import React from "react";
import { Button } from "@/components/ui/button";
import {
  Meta,
  MetaGrid,
  Panel,
  toneButton,
  type Tone,
} from "@/components/ui/entity";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { RefreshCw } from "lucide-react";
import { UserDevice } from "@/types";

type ConfirmAction = "approve" | "reject" | "delete" | "toggle";
type ResolvedAction = "approve" | "reject" | "delete";

interface ConfirmActionData {
  device: UserDevice;
  action: ConfirmAction;
  title: string;
  description: string;
}

interface ConfirmationModalProps {
  confirmAction: ConfirmActionData | null;
  actionLoading: number | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const ACTION_LABELS: Record<ResolvedAction, string> = {
  approve: "Approve Device",
  reject: "Reject Device",
  delete: "Delete Device",
};

const ACTION_TONES: Record<ResolvedAction, Tone> = {
  approve: "positive",
  reject: "danger",
  delete: "danger",
};

const resolveAction = (
  action: ConfirmAction,
  device: UserDevice,
): ResolvedAction => {
  if (action !== "toggle") return action;
  return device.status === "approved" ? "reject" : "approve";
};

const isDestructiveOutline = (
  action: ConfirmAction,
  resolved: ResolvedAction,
) => action === "delete" || (action === "toggle" && resolved === "reject");

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  confirmAction,
  actionLoading,
  onConfirm,
  onCancel,
}) => {
  if (!confirmAction) return null;

  const { device, action } = confirmAction;
  const resolved = resolveAction(action, device);
  const tone = ACTION_TONES[resolved];
  const outlined = isDestructiveOutline(action, resolved);
  const isRunning = actionLoading !== null;

  return (
    <Modal open onOpenChange={onCancel} size="md">
      <ModalHeader
        title={confirmAction.title}
        description={confirmAction.description}
      />

      <ModalBody>
        <Panel tone={tone}>
          <p className="truncate text-sm font-semibold text-foreground">
            {device.deviceName || device.deviceIdentifier}
          </p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {device.username || device.userId}
          </p>
          <MetaGrid className="mt-4 sm:grid-cols-2">
            <Meta label="Platform">{device.devicePlatform || "Unknown"}</Meta>
            <Meta label="Product">{device.deviceProduct || "Unknown"}</Meta>
            <Meta label="IP Address">{device.ipAddress || "Unknown"}</Meta>
            <Meta label="Last Seen">
              {device.lastSeen
                ? new Date(device.lastSeen).toLocaleString()
                : "Never"}
            </Meta>
          </MetaGrid>
        </Panel>
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={onCancel} disabled={isRunning}>
          Cancel
        </Button>
        <Button
          variant={outlined ? "outline" : "default"}
          onClick={onConfirm}
          disabled={isRunning}
          className={toneButton(tone, outlined ? "outline" : "solid")}
        >
          {isRunning ? (
            <>
              <RefreshCw className="size-4 animate-spin" />
              Processing...
            </>
          ) : (
            ACTION_LABELS[resolved]
          )}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
