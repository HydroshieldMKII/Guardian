import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalFooter, ModalHeader } from "@/components/ui/modal";

interface LeaveSettingsModalProps {
  open: boolean;
  isSaving: boolean;
  saveBlocked: boolean;
  onStay: () => void;
  onDiscard: () => void;
  onSave: () => void;
}

export function LeaveSettingsModal({
  open,
  isSaving,
  saveBlocked,
  onStay,
  onDiscard,
  onSave,
}: LeaveSettingsModalProps) {
  return (
    <Modal open={open} onOpenChange={(next) => !next && onStay()} size="md">
      <ModalHeader
        title="Unsaved changes"
        description="You have unsaved changes that will be lost if you leave this page. What would you like to do?"
      />
      <ModalFooter>
        <Button variant="outline" onClick={onStay}>
          Stay on page
        </Button>
        <Button variant="destructive" onClick={onDiscard}>
          Discard changes
        </Button>
        <Button onClick={onSave} disabled={isSaving || saveBlocked}>
          {isSaving && <Loader2 className="size-4 animate-spin" />}
          Save & Leave
        </Button>
      </ModalFooter>
    </Modal>
  );
}
