import React from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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

const ACTION_LABELS = {
  approve: "Approve Device",
  reject: "Reject Device",
  delete: "Delete Device",
} as const;

const GREEN_BUTTON = {
  variant: "default" as const,
  className: "w-full sm:w-auto bg-green-500 hover:bg-green-600 text-white",
};

const SOLID_RED_BUTTON = {
  variant: "default" as const,
  className:
    "w-full sm:w-auto bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800",
};

const OUTLINE_RED_BUTTON = {
  variant: "outline" as const,
  className:
    "w-full sm:w-auto border-red-600 text-red-600 hover:bg-red-100 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20",
};

const resolveAction = (
  action: ConfirmAction,
  device: UserDevice,
): ResolvedAction => {
  if (action !== "toggle") return action;
  return device.status === "approved" ? "reject" : "approve";
};

const buttonStyleFor = (
  action: ConfirmAction,
  resolved: ResolvedAction,
): typeof GREEN_BUTTON | typeof OUTLINE_RED_BUTTON => {
  if (action === "delete") return OUTLINE_RED_BUTTON;
  if (action === "toggle") {
    return resolved === "reject" ? OUTLINE_RED_BUTTON : GREEN_BUTTON;
  }
  return action === "reject" ? SOLID_RED_BUTTON : GREEN_BUTTON;
};

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  confirmAction,
  actionLoading,
  onConfirm,
  onCancel,
}) => {
  if (!confirmAction) return null;

  const { device, action } = confirmAction;
  const resolved = resolveAction(action, device);
  const buttonProps = buttonStyleFor(action, resolved);
  const isRunning = actionLoading !== null;

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-lg overflow-x-hidden">
        <DialogHeader className="overflow-hidden">
          <DialogTitle className="text-left text-lg font-semibold leading-tight tracking-tight text-foreground">
            {confirmAction.title}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-1.5">
            {confirmAction.description}
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 p-3 sm:p-4 bg-muted rounded-lg overflow-hidden">
          <div className="flex items-center gap-3 mb-2">
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="text-sm font-medium text-foreground truncate">
                {device.deviceName || device.deviceIdentifier}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {device.username || device.userId}
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Platform: {device.devicePlatform || "Unknown"} • Product:{" "}
            {device.deviceProduct || "Unknown"}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isRunning}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            variant={buttonProps.variant}
            onClick={onConfirm}
            disabled={isRunning}
            className={buttonProps.className}
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              ACTION_LABELS[resolved]
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
