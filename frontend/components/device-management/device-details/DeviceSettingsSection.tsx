import { ActionRow, Panel, Section, ToggleRow } from "@/components/ui/entity";
import { SetPendingButton } from "./SetPendingButton";

export function DeviceSettingsSection({
  plexamp,
  excluded,
  savingExclusion,
  onExcludedChange,
  canSetPending,
  strictMode,
  savingPending,
  onSetPending,
}: {
  plexamp: boolean;
  excluded: boolean;
  savingExclusion: boolean;
  onExcludedChange: (exclude: boolean) => void;
  canSetPending: boolean;
  strictMode: boolean;
  savingPending: boolean;
  onSetPending: () => void;
}) {
  if (plexamp) {
    return (
      <Section title="Device settings">
        <Panel>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Plex provides no way to terminate a Plexamp stream, so nothing can
            be enforced against this device. It is exempt from every policy,
            including the concurrent stream limit.
          </p>
        </Panel>
      </Section>
    );
  }

  return (
    <Section title="Device settings">
      <ToggleRow
        id="exclude-concurrent-limit"
        label="Exclude from concurrent stream limit"
        hint="Streams from this device stop counting towards the user's concurrent stream limit, and never block another device from starting."
        checked={excluded}
        onCheckedChange={onExcludedChange}
        disabled={savingExclusion}
      />
      {canSetPending && (
        <ActionRow
          title="Set back to pending"
          description="Undo your decision on this device. It follows this user's New devices rule until you approve or reject it again."
          action={
            <SetPendingButton
              strictMode={strictMode}
              saving={savingPending}
              onClick={onSetPending}
            />
          }
        />
      )}
    </Section>
  );
}
