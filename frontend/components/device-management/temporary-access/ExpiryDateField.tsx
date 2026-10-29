import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field } from "@/components/ui/entity";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { EXPIRY_FORMAT } from "./options";

const TIME_PARTS = [
  {
    placeholder: "HH",
    max: 23,
    read: (date: Date) => date.getHours(),
    write: (date: Date, value: number) => date.setHours(value),
  },
  {
    placeholder: "MM",
    max: 59,
    read: (date: Date) => date.getMinutes(),
    write: (date: Date, value: number) => date.setMinutes(value),
  },
];

const anHourFromNowOn = (date: Date) => {
  const now = new Date();
  date.setHours(now.getHours() + 1);
  date.setMinutes(now.getMinutes());
  return date;
};

interface ExpiryDateFieldProps {
  date: Date | undefined;
  onChange: (date: Date | undefined) => void;
}

export function ExpiryDateField({ date, onChange }: ExpiryDateFieldProps) {
  return (
    <Field label="Expires on">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground",
            )}
          >
            {date ? (
              date.toLocaleString(undefined, EXPIRY_FORMAT)
            ) : (
              <span>Pick a date and time</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={(picked) =>
              onChange(picked ? anHourFromNowOn(picked) : undefined)
            }
            disabled={(day) => day < new Date()}
            autoFocus
          />
          {date && (
            <div className="border-t p-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">
                Time
              </p>
              <div className="flex gap-2">
                {TIME_PARTS.map((part, index) => (
                  <Fragment key={part.placeholder}>
                    {index > 0 && (
                      <span className="self-center text-muted-foreground">
                        :
                      </span>
                    )}
                    <Input
                      type="number"
                      min="0"
                      max={String(part.max)}
                      value={part.read(date)}
                      onChange={(e) => {
                        const next = new Date(date);
                        part.write(
                          next,
                          Math.min(
                            part.max,
                            Math.max(0, parseInt(e.target.value) || 0),
                          ),
                        );
                        onChange(next);
                      }}
                      className="w-16 text-center"
                      placeholder={part.placeholder}
                    />
                  </Fragment>
                ))}
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </Field>
  );
}
