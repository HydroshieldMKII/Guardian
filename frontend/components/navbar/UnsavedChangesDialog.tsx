import { AlertTriangle, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function UnsavedChangesDialog({
  open,
  isSaving,
  saveBlocked,
  onStay,
  onSave,
  onDiscard,
}: {
  open: boolean;
  isSaving: boolean;
  saveBlocked: boolean;
  onStay: () => void;
  onSave: () => void;
  onDiscard: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onStay()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-waiting" />
            Unsaved changes
          </DialogTitle>
          <DialogDescription>
            You have unsaved changes that will be lost if you leave this page.
            What would you like to do?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={onStay}
            className="order-1 sm:order-1"
          >
            Stay on page
          </Button>
          <Button
            onClick={onSave}
            disabled={isSaving || saveBlocked}
            className="order-2 sm:order-2"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save & Leave
          </Button>
          <Button
            variant="destructive"
            onClick={onDiscard}
            className="order-3 sm:order-3"
          >
            Discard changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
