import { CheckCircle2 } from "lucide-react";
import {
  getPasswordRequirements,
  PASSWORD_RULE_LABELS,
} from "@/lib/password-rules";

export function PasswordRequirementList({ password }: { password: string }) {
  const requirements = getPasswordRequirements(password);

  return (
    <div className="space-y-1.5 rounded-md border bg-muted/40 p-3">
      {PASSWORD_RULE_LABELS.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-2 text-xs">
          {requirements[key] ? (
            <CheckCircle2 className="size-3 text-emerald-600" />
          ) : (
            <div className="size-3 rounded-full border border-muted-foreground" />
          )}
          <span
            className={
              requirements[key]
                ? "text-emerald-700 dark:text-emerald-400"
                : "text-muted-foreground"
            }
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
