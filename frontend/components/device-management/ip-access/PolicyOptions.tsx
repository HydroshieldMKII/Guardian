import { OptionCard, OptionGroup } from "@/components/ui/entity";
import type { PolicyOption } from "./options";

interface PolicyOptionsProps<Value extends string> {
  options: PolicyOption<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  className: string;
}

export function PolicyOptions<Value extends string>({
  options,
  value,
  onChange,
  className,
}: PolicyOptionsProps<Value>) {
  return (
    <OptionGroup className={className}>
      {options.map((option) => (
        <OptionCard
          key={option.value}
          selected={value === option.value}
          title={option.title}
          description={option.description}
          onSelect={() => onChange(option.value)}
        />
      ))}
    </OptionGroup>
  );
}
