import { Panel, Section, ToggleRow } from "@/components/ui/entity";
import { BYPASSED_POLICIES } from "./options";

interface PolicyBypassSectionProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export function PolicyBypassSection({
  checked,
  onCheckedChange,
}: PolicyBypassSectionProps) {
  return (
    <Section title="Policy bypass">
      <Panel tone="warning" className="space-y-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          While temporary access lasts, the selected devices stream without any
          of the following being enforced:
        </p>
        <ul className="space-y-1.5 text-xs text-muted-foreground">
          {BYPASSED_POLICIES.map((policy) => (
            <li key={policy.name}>
              <span className="font-medium text-foreground">{policy.name}</span>{" "}
              — {policy.detail}
            </li>
          ))}
        </ul>
        <ToggleRow
          id="bypass-policies"
          label="Bypass these policies for the selected devices"
          hint="The concurrent stream limit is not affected. Whether temporary access counts towards it is controlled by its own setting in Settings."
          checked={checked}
          onCheckedChange={onCheckedChange}
        />
      </Panel>
    </Section>
  );
}
