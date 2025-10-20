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
import { CheckCircle, XCircle, Trash2, RefreshCw } from "lucide-react";
import { UserDevice } from "@/types";
import { getDeviceIcon } from "./SharedComponents";

interface ConfirmActionData {
  device: UserDevice;
  action: "approve" | "reject" | "delete" | "toggle";
  title: string;
  description: string;
}

interface ConfirmationModalProps {
  confirmAction: ConfirmActionData | null;
  actionLoading: number | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  confirmAction,
  actionLoading,
  onConfirm,
  onCancel,
}) => {
  if (!confirmAction) return null;

  const getActionIcon = () => {
    switch (confirmAction.action) {
      case "approve":
        return <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />;
      case "reject":
        return <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />;
      case "delete":
        return <Trash2 className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />;
      case "toggle":
        return confirmAction.device.status === "approved" ? (
          <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
        ) : (
          <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
        );
      default:
        return null;
    }
  };

  const getButtonProps = () => {
    switch (confirmAction.action) {
      case "approve":
      case "toggle":
        if (confirmAction.device.status === "approved") {
          return {
            variant: "outline" as const,
            className:
              "w-full sm:w-auto border-red-600 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20",
          };
        }
        return {
          variant: "default" as const,
          className:
            "w-full sm:w-auto bg-green-500 hover:bg-green-600 text-white",
        };
      case "reject":
        return {
          variant: "outline" as const,
          className:
            "w-full sm:w-auto border-red-600 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20",
        };
      case "delete":
        return {
          variant: "outline" as const,
          className:
            "w-full sm:w-auto border-red-600 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20",
        };
      default:
        return {
          variant: "default" as const,
          className: "w-full sm:w-auto",
        };
    }
  };

  const getButtonText = () => {
    switch (confirmAction.action) {
      case "approve":
        return "Approve Device";
      case "reject":
        return "Reject Device";
      case "delete":
        return "Delete Device";
      case "toggle":
        return confirmAction.device.status === "approved"
          ? "Reject Device"
          : "Approve Device";
      default:
        return "Confirm";
    }
  };

  const getButtonIcon = () => {
    if (actionLoading) {
      return <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-2 animate-spin" />;
    }

    switch (confirmAction.action) {
      case "approve":
        return <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />;
      case "reject":
        return <XCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />;
      case "delete":
        return <Trash2 className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />;
      case "toggle":
        return confirmAction.device.status === "approved" ? (
          <XCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
        ) : (
          <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
        );
      default:
        return null;
    }
  };

  const buttonProps = getButtonProps();

  return (
    <Dialog open={!!confirmAction} onOpenChange={onCancel}>
      <DialogContent className="max-w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg text-foreground">
            {getActionIcon()}
            {confirmAction.title}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {confirmAction.description}
          </DialogDescription>
        </DialogHeader>

        <div className="my-4 p-3 sm:p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-3 mb-2">
            {getDeviceIcon(
              confirmAction.device.devicePlatform,
              confirmAction.device.deviceProduct
            )}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground truncate">
                {confirmAction.device.deviceName ||
                  confirmAction.device.deviceIdentifier}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {confirmAction.device.username || confirmAction.device.userId}
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Platform: {confirmAction.device.devicePlatform || "Unknown"} •{" "}
            Product: {confirmAction.device.deviceProduct || "Unknown"}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={actionLoading !== null}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            variant={buttonProps.variant}
            onClick={onConfirm}
            disabled={actionLoading !== null}
            className={buttonProps.className}
          >
            {actionLoading ? (
              <>
                <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {getButtonIcon()}
                {getButtonText()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
