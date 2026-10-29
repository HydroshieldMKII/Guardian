import type { ComponentProps } from "react";
import { Mail } from "lucide-react";
import { Field, StatusPill } from "@/components/ui/entity";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FieldError } from "@/components/auth-form/FieldError";

interface SetupEmailInputProps extends ComponentProps<typeof Input> {
  error?: string;
}

export function SetupEmailInput({
  error,
  ...inputProps
}: SetupEmailInputProps) {
  return (
    <Field
      label="Email"
      htmlFor="email"
      hint="Needed to reset your password if you forget it."
      action={<StatusPill tone="neutral">Optional</StatusPill>}
    >
      <div className="relative">
        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="your@email.com"
          className={cn(
            "pl-10",
            error && "border-red-500 focus-visible:ring-red-500",
          )}
          {...inputProps}
        />
      </div>
      <FieldError message={error} />
    </Field>
  );
}
