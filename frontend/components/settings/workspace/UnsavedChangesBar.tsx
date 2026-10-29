import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UnsavedChangesBarProps {
  isSaving: boolean;
  saveBlocked: boolean;
  onCancel: () => void;
  onSave: () => void;
}

export function UnsavedChangesBar({
  isSaving,
  saveBlocked,
  onCancel,
  onSave,
}: UnsavedChangesBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="container mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="size-2 shrink-0 animate-pulse rounded-full bg-waiting"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              You have unsaved changes
            </p>
            <p className="text-xs text-muted-foreground">
              {saveBlocked
                ? "Fix the highlighted settings to save."
                : "Save them to apply the new configuration."}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={onCancel}
            disabled={isSaving}
            size="sm"
            variant="outline"
            className="flex-1 sm:flex-none"
          >
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={isSaving || saveBlocked}
            size="sm"
            className="flex-1 sm:flex-none"
          >
            {isSaving && <Loader2 className="size-4 animate-spin" />}
            Save now
          </Button>
        </div>
      </div>
    </div>
  );
}
