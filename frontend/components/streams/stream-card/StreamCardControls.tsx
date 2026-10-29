import { ChevronDown } from "lucide-react";
import { ActionMenu } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlexSession } from "@/types";
import {
  navigationActions,
  removeAccessAction,
  type StreamNavigation,
} from "./stream-actions";

const OVER_ART =
  "border-white/20 bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 hover:text-white dark:bg-black/50 dark:hover:bg-black/70";

interface StreamCardControlsProps extends StreamNavigation {
  stream: PlexSession;
  overArt: boolean;
  isExpanded: boolean;
  isRevoking: boolean;
  onToggleExpand: () => void;
  onRemoveAccess: () => void;
}

export function StreamCardControls({
  stream,
  overArt,
  isExpanded,
  isRevoking,
  onToggleExpand,
  onRemoveAccess,
  ...navigation
}: StreamCardControlsProps) {
  const secondary = overArt ? OVER_ART : "";
  const detailsLabel = isExpanded ? "Hide details" : "Show details";

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="sm"
        onClick={onToggleExpand}
        aria-expanded={isExpanded}
        aria-label={detailsLabel}
        title={detailsLabel}
        className={cn("size-8 px-0", secondary)}
      >
        <ChevronDown
          className={cn(
            "transition-transform duration-200 motion-reduce:transition-none",
            isExpanded && "rotate-180",
          )}
        />
      </Button>
      <ActionMenu
        busy={isRevoking}
        actions={navigationActions(stream, navigation)}
        destructive={removeAccessAction(stream, isRevoking, onRemoveAccess)}
        className={secondary}
      />
    </div>
  );
}
