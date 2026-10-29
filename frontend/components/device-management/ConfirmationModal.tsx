import React from "react";
import { Button } from "@/components/ui/button";
import { toneButton, toneTint, type Tone } from "@/components/ui/entity";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import {
  Ban,
  Check,
  RefreshCw,
  TimerOff,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserDevice } from "@/types";

export type ConfirmAction =
  "approve" | "reject" | "delete" | "toggle" | "removeTemporaryAccess";
type ResolvedAction = "approve" | "reject" | "delete" | "removeTemporaryAccess";

export interface ConfirmActionData {
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
  approve: "Approve device",
  reject: "Reject device",
  delete: "Delete device",
  removeTemporaryAccess: "Remove temporary access",
};

const ACTION_TONES: Record<ResolvedAction, Tone> = {
  approve: "positive",
  reject: "danger",
  delete: "danger",
  removeTemporaryAccess: "warning",
};

const ACTION_ICONS: Record<ResolvedAction, LucideIcon> = {
  approve: Check,
  reject: Ban,
  delete: Trash2,
  removeTemporaryAccess: TimerOff,
};

const DetailRow = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-baseline justify-between gap-4 px-3 py-2.5">
    <dt className="shrink-0 text-muted-foreground">{label}</dt>
    <dd className="min-w-0 truncate text-right text-foreground">{children}</dd>
  </div>
);

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
) =>
  action === "delete" ||
  action === "removeTemporaryAccess" ||
  (action === "toggle" && resolved === "reject");

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
  const Icon = ACTION_ICONS[resolved];

  return (
    <Modal open onOpenChange={onCancel} size="md">
      <ModalHeader
        title={confirmAction.title}
        description={confirmAction.description}
      />

      <ModalBody className="space-y-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              toneTint(tone),
            )}
          >
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-foreground">
              {device.deviceName || device.deviceIdentifier}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {device.username || device.userId}
            </p>
          </div>
        </div>

        <dl className="divide-y divide-border/70 rounded-lg border text-sm">
          <DetailRow label="Platform">
            {device.devicePlatform || "Unknown"}
          </DetailRow>
          <DetailRow label="Product">
            {device.deviceProduct || "Unknown"}
          </DetailRow>
          <DetailRow label="IP address">
            <span className="font-mono text-[13px]">
              {device.ipAddress || "Unknown"}
            </span>
          </DetailRow>
          <DetailRow label="Last seen">
            {device.lastSeen
              ? new Date(device.lastSeen).toLocaleString()
              : "Never"}
          </DetailRow>
        </dl>

        {device.requestDescription && (
          <div className="rounded-lg bg-waiting/10 px-3 py-2.5">
            <p className="text-xs font-medium text-waiting">Note from user</p>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground">
              {device.requestDescription}
            </p>
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button
          variant="outline"
          onClick={() => onCancel()}
          disabled={isRunning}
        >
          Cancel
        </Button>
        <Button
          variant={outlined ? "outline" : "default"}
          onClick={() => onConfirm()}
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
