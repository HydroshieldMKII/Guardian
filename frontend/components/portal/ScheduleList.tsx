import { StatusPill } from "@/components/ui/entity";
import { dayLabel } from "@/lib/time-rules";
import type { PortalTimeRule } from "@/types";

export function ScheduleList({ rules }: { rules: PortalTimeRule[] }) {
  return (
    <ul className="divide-y divide-border/70 rounded-lg border bg-background/40">
      {rules.map((rule) => (
        <li
          key={rule.id}
          className="flex items-center justify-between gap-3 px-3 py-2.5"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {dayLabel(rule.dayOfWeek)}
              {rule.ruleName && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  ({rule.ruleName})
                </span>
              )}
            </p>
            <p className="text-xs tabular-nums text-muted-foreground">
              {rule.startTime} – {rule.endTime}
            </p>
          </div>
          <StatusPill size="sm" tone={rule.enabled ? "danger" : "neutral"}>
            {rule.enabled ? "Blocking" : "Paused"}
          </StatusPill>
        </li>
      ))}
    </ul>
  );
}
