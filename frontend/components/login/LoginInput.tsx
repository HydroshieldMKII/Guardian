import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FieldError } from "./FieldError";

interface LoginInputProps extends ComponentProps<typeof Input> {
  id: string;
  label: string;
  icon: LucideIcon;
  error?: string;
  trailing?: ReactNode;
  footer?: ReactNode;
}

export function LoginInput({
  id,
  label,
  icon: Icon,
  error,
  trailing,
  footer,
  className,
  ...inputProps
}: LoginInputProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-semibold text-foreground">
        {label}
      </label>
      <div className="relative">
        <Icon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          id={id}
          name={id}
          className={cn(
            "pl-10",
            className,
            error && "border-red-500 focus-visible:ring-red-500",
          )}
          {...inputProps}
        />
        {trailing}
      </div>
      <FieldError message={error} />
      {footer}
    </div>
  );
}
