import React from "react";
import { Button } from "@/components/ui/button";
import { Meta, MetaGrid, Panel, toneButton } from "@/components/ui/entity";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { RefreshCw } from "lucide-react";
import { getContentTitle } from "./SharedComponents";
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
    <Modal
      open={!!stream}
      onOpenChange={(open) => !open && onCancel()}
      size="md"
    >
      <ModalHeader
        title="Remove Device Access"
        description="Are you sure you want to remove access for this device? This will immediately stop the current stream and prevent future access until the device is manually re-approved."
      />

      {stream && (
        <ModalBody>
          <Panel tone="danger">
            <p className="truncate text-sm font-semibold text-foreground">
              {getContentTitle(stream)}
            </p>
            <MetaGrid className="mt-4 sm:grid-cols-2">
              <Meta label="User">{stream.User?.title || "Unknown User"}</Meta>
              <Meta label="Device">
                {stream.Player?.title || "Unknown Device"}
              </Meta>
            </MetaGrid>
          </Panel>
        </ModalBody>
      )}

      <ModalFooter>
        <Button
          variant="outline"
          onClick={() => onCancel()}
          disabled={isRemoving}
        >
          Cancel
        </Button>
        <Button
          onClick={() => onConfirm()}
          disabled={isRemoving}
          className={toneButton("danger", "solid")}
        >
          {isRemoving ? (
            <>
              <RefreshCw className="size-4 animate-spin" />
              Removing...
            </>
          ) : (
            "Remove Access"
          )}
        </Button>
      </ModalFooter>
    </Modal>
  );
};
