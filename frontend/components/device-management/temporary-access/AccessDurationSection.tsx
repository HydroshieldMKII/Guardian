import { Panel, Section, SegmentedControl } from "@/components/ui/entity";
import type { useTemporaryAccessForm } from "@/hooks/device-management/useTemporaryAccessForm";
import { DurationFields } from "./DurationFields";
import { ExpiryDateField } from "./ExpiryDateField";
import { EXPIRY_FORMAT } from "./options";

const ERROR_TEXT = "text-xs text-rose-600 dark:text-rose-400";

export function AccessDurationSection({
  form,
}: {
  form: ReturnType<typeof useTemporaryAccessForm>;
}) {
  return (
    <Section
      title="Access duration"
      action={
        <SegmentedControl
          value={form.mode}
          onChange={form.setMode}
          options={[
            { value: "duration", label: "Duration" },
            { value: "calendar", label: "Calendar" },
          ]}
        />
      }
    >
      {form.mode === "duration" ? (
        <DurationFields
          value={form.durationValue}
          unit={form.durationUnit}
          onValueChange={form.setDurationValue}
          onUnitChange={form.setDurationUnit}
          onChoose={form.chooseDuration}
        />
      ) : (
        <ExpiryDateField
          date={form.selectedDate}
          onChange={form.setSelectedDate}
        />
      )}

      {form.durationInvalid && (
        <p className={ERROR_TEXT}>Please enter a valid duration</p>
      )}

      {form.dateInPast && (
        <p className={ERROR_TEXT}>Selected date must be in the future</p>
      )}

      {form.durationTooLarge && (
        <Panel tone="danger">
          <p className={ERROR_TEXT}>
            Duration is too large. Please enter a smaller value.
          </p>
        </Panel>
      )}

      {form.expiry && (
        <Panel tone="info">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
            Access will expire at
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {form.expiry.toLocaleString(undefined, {
              ...EXPIRY_FORMAT,
              second: "2-digit",
              timeZoneName: "short",
            })}
          </p>
        </Panel>
      )}
    </Section>
  );
}
