import React, { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { cn } from "@/lib/utils";

interface HintTooltipProps {
  hint: React.ReactNode;
  screenReaderHint?: string;
  side?: React.ComponentProps<typeof TooltipContent>["side"];
  align?: React.ComponentProps<typeof TooltipContent>["align"];
  triggerClassName?: string;
  contentClassName?: string;
  children: React.ReactNode;
}

export const HintTooltip: React.FC<HintTooltipProps> = ({
  hint,
  screenReaderHint,
  side,
  align,
  triggerClassName,
  contentClassName,
  children,
}) => {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const announced =
    screenReaderHint ?? (typeof hint === "string" ? hint : undefined);

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip
        open={open}
        onOpenChange={(next) => {
          if (!next) setOpen(false);
        }}
      >
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex rounded-md focus:outline-none",
              triggerClassName,
            )}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (isMobile) setOpen((previous) => !previous);
            }}
            onMouseEnter={() => {
              if (!isMobile) setOpen(true);
            }}
            onMouseLeave={() => {
              if (!isMobile) setOpen(false);
            }}
          >
            {children}
            {announced && <span className="sr-only">{announced}</span>}
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          className={cn("max-w-xs", contentClassName)}
          onPointerDownOutside={(event) => {
            event.preventDefault();
            setOpen(false);
          }}
        >
          {hint}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
