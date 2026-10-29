import { RefreshCw } from "lucide-react";
import { SegmentedControl } from "@/components/ui/entity";
import { usePendingPolicy } from "@/hooks/device-management/usePendingPolicy";
import { useSettings } from "@/hooks/useSettings";
import { POLICY_CHOICES } from "./rule-labels";

export function NewDevicesRule({
  storedPolicy,
  saving,
  onSave,
}: {
  storedPolicy: boolean | null;
  saving: boolean;
  onSave: (defaultBlock: boolean | null) => void;
}) {
  const { getGlobalDefaultBlock, loading: configLoading } = useSettings();
  const policy = usePendingPolicy(storedPolicy, saving);
  const globalLabel = configLoading
    ? "Global"
    : `Global (${getGlobalDefaultBlock() ? "Block" : "Allow"})`;

  return (
    <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium text-foreground">
          New devices
          {saving && (
            <RefreshCw
              aria-label="Saving the New devices rule"
              className="size-3 animate-spin text-muted-foreground"
            />
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          What happens the first time this user streams from a device that has
          not been seen before
        </p>
      </div>
      <SegmentedControl
        className="w-full sm:w-auto sm:min-w-[300px]"
        busy={saving}
        value={policy.value}
        onChange={(next) => policy.choose(next, onSave)}
        options={POLICY_CHOICES.map((choice) => ({
          value: choice.value,
          tone: choice.tone,
          label: choice.value === null ? globalLabel : choice.label,
        }))}
      />
    </div>
  );
}
