import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DAYS_OF_WEEK, dayLabel } from "@/lib/time-rules";

export function DayPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (dayOfWeek: number) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between font-normal"
        >
          {dayLabel(value)}
          <ChevronDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[160px]">
        {DAYS_OF_WEEK.map((day) => (
          <DropdownMenuItem key={day.value} onClick={() => onChange(day.value)}>
            {day.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
