import { Button } from "@/components/ui/button";
import { ActionRow, toneButton } from "@/components/ui/entity";
import { SettingsCard } from "@/components/settings/settings-ui";
import { BusyLabel } from "./BusyLabel";
import type { ProtectedAction } from "./protected-actions";

interface ProtectedActionsCardProps {
  title: string;
  description: string;
  actions: ProtectedAction[];
  danger?: boolean;
  busy: ProtectedAction | null;
  onStart: (action: ProtectedAction) => void;
}

export function ProtectedActionsCard({
  title,
  description,
  actions,
  danger = false,
  busy,
  onStart,
}: ProtectedActionsCardProps) {
  return (
    <SettingsCard title={title} description={description}>
      {actions.map((action) => {
        const running = busy?.key === action.key;
        return (
          <ActionRow
            key={action.key}
            tone={danger ? "danger" : "neutral"}
            title={action.title}
            description={action.description}
            action={
              <Button
                onClick={() => onStart(action)}
                disabled={running}
                size="sm"
                variant="outline"
                className={`w-full sm:w-auto${danger ? ` ${toneButton("danger")}` : ""}`}
              >
                <BusyLabel
                  busy={running}
                  label={action.title}
                  busyLabel={action.busyLabel}
                />
              </Button>
            }
          />
        );
      })}
    </SettingsCard>
  );
}
