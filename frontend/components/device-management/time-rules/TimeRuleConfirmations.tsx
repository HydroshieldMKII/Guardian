import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import type { TimeRuleBulkActions } from "@/hooks/device-management/useTimeRuleBulkActions";

export function TimeRuleConfirmations({ bulk }: { bulk: TimeRuleBulkActions }) {
  const weekdaysOnly = bulk.presetToConfirm === "weekdays-only";

  return (
    <>
      <ConfirmationModal
        isOpen={bulk.confirmingDeleteAll}
        onClose={bulk.cancelDeleteAll}
        onConfirm={() => void bulk.deleteAll()}
        title="Delete every rule?"
        description="This permanently deletes every rule in this user's time schedule, so they will be able to stream at any time. This cannot be undone."
        confirmText="Delete all"
        variant="destructive"
        loading={bulk.deletingAll}
      />

      <ConfirmationModal
        isOpen={!!bulk.presetToConfirm}
        onClose={bulk.cancelPreset}
        onConfirm={() => void bulk.confirmPreset()}
        title={weekdaysOnly ? "Allow weekdays only?" : "Allow weekends only?"}
        description={
          weekdaysOnly
            ? "This deletes every existing rule and blocks streaming all day on Saturday and Sunday. This cannot be undone."
            : "This deletes every existing rule and blocks streaming all day from Monday to Friday. This cannot be undone."
        }
        confirmText="Apply preset"
        variant="default"
        loading={bulk.applyingPreset === bulk.presetToConfirm}
      />
    </>
  );
}
