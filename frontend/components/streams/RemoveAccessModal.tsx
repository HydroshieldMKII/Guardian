import React from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserX, RefreshCw, User } from "lucide-react";
import { getContentTitle, getDeviceIcon } from './SharedComponents';
import { PlexSession } from "@/types";

interface RemoveAccessModalProps {
  stream: PlexSession | null;
  isRemoving: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const RemoveAccessModal: React.FC<RemoveAccessModalProps> = ({
  stream,
  isRemoving,
  onConfirm,
  onCancel,
}) => {
  return (
    <Dialog
      open={!!stream}
      onOpenChange={(open) => !open && onCancel()}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserX className="w-5 h-5 text-red-500" />
            Remove Device Access
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to remove access for this device? This will
            immediately stop the current stream and prevent future access
            until the device is manually re-approved.
          </DialogDescription>
        </DialogHeader>

        {stream && (
          <div className="my-4 p-4 bg-muted rounded-lg">
            <div className="text-sm font-medium text-foreground mb-2 line-clamp-2 break-words leading-tight">
              {getContentTitle(stream)}
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              <div className="flex items-center gap-1 min-w-0">
                <User className="w-3 h-3 flex-shrink-0" />
                <span className="truncate max-w-[120px]">
                  {stream.User?.title || "Unknown User"}
                </span>
              </div>
              <div className="flex items-center gap-1 min-w-0">
                {getDeviceIcon(stream.Player?.platform)}
                <span className="truncate max-w-[120px]">
                  {stream.Player?.title || "Unknown Device"}
                </span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isRemoving}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={isRemoving}
            className="bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-800"
          >
            {isRemoving ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Removing...
              </>
            ) : (
              <>
                <UserX className="w-4 h-4 mr-2" />
                Remove Access
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};