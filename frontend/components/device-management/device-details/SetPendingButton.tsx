import { Button } from "@/components/ui/button";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { Spinner } from "./Spinner";

export function SetPendingButton({
  strictMode,
  saving,
  onClick,
}: {
  strictMode: boolean;
  saving: boolean;
  onClick: () => void;
}) {
  if (strictMode) {
    return (
      <HintTooltip
        side="top"
        align="center"
        triggerClassName="h-8 w-full cursor-not-allowed items-center justify-center whitespace-nowrap rounded-md border border-dashed bg-background px-3 text-sm font-medium text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring sm:w-auto"
        hint="Strict mode is on, so every device is approved or rejected automatically using this user's New devices rule. Turn strict mode off in settings to move a device back to pending."
      >
        Set to pending
      </HintTooltip>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={saving}
      className="w-full sm:w-auto"
    >
      {saving && <Spinner />}
      Set to pending
    </Button>
  );
}
