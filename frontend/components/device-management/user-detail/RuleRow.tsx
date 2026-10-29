import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function RuleRow({
  title,
  description,
  value,
  onClick,
  active,
}: {
  title: string;
  description: string;
  value: string;
  onClick: () => void;
  active: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-4 px-4 py-3.5 text-left transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-accent/60 sm:px-5"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {description}
        </span>
      </span>
      <span
        className={cn(
          "shrink-0 text-right text-sm",
          active ? "font-medium text-foreground" : "text-muted-foreground",
        )}
      >
        {value}
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </button>
  );
}
