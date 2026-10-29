import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/entity";
import { Input } from "@/components/ui/input";
import type { DurationUnit } from "@/lib/duration";
import { DURATION_UNITS, QUICK_DURATIONS } from "./options";

interface DurationFieldsProps {
  value: number;
  unit: DurationUnit;
  onValueChange: (value: number) => void;
  onUnitChange: (unit: DurationUnit) => void;
  onChoose: (value: number, unit: DurationUnit) => void;
}

export function DurationFields({
  value,
  unit,
  onValueChange,
  onUnitChange,
  onChoose,
}: DurationFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <Field label="Duration" htmlFor="duration-value" className="flex-1">
          <Input
            id="duration-value"
            type="number"
            value={value}
            onChange={(e) => onValueChange(Number(e.target.value))}
            min="1"
            max="999"
            placeholder="Enter duration"
          />
        </Field>
        <Field label="Unit" className="w-28">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                aria-label="Duration unit"
                className="w-full justify-between font-normal"
              >
                {unit}
                <ChevronDown className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {DURATION_UNITS.map((option) => (
                <DropdownMenuItem
                  key={option}
                  onClick={() => onUnitChange(option)}
                >
                  {option}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </Field>
      </div>

      <Field label="Common durations">
        <div className="flex flex-wrap gap-2">
          {QUICK_DURATIONS.map((quick) => (
            <Button
              key={quick.label}
              variant="outline"
              size="sm"
              onClick={() => onChoose(quick.value, quick.unit)}
            >
              {quick.label}
            </Button>
          ))}
        </div>
      </Field>
    </div>
  );
}
