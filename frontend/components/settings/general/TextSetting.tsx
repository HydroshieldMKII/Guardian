import { Field } from "@/components/ui/entity";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getSettingInfo } from "../settings-utils";
import { INTEGER_RULES, settingError } from "../setting-validation";
import { settingText, type SettingFieldProps } from "./types";

const STREAM_LIMIT_KEY = "CONCURRENT_STREAM_LIMIT";

export function TextSetting({
  setting,
  formData,
  onChange,
  disabled,
}: SettingFieldProps) {
  const { label, description } = getSettingInfo(setting);
  const error = settingError(setting.key, settingText(setting, formData));
  const numeric =
    setting.type === "number" ||
    setting.key.includes("INTERVAL") ||
    setting.key === STREAM_LIMIT_KEY;

  return (
    <Field
      label={label}
      htmlFor={setting.key}
      hint={description}
      error={error}
      inline={numeric}
      className={cn(
        "transition-opacity duration-200",
        disabled && "opacity-60",
      )}
    >
      <Input
        id={setting.key}
        type={numeric ? "number" : "text"}
        className={cn(
          numeric && "w-full tabular-nums sm:w-28",
          error && "border-blocked",
        )}
        aria-invalid={Boolean(error)}
        min={numeric ? INTEGER_RULES[setting.key]?.min : undefined}
        max={numeric ? INTEGER_RULES[setting.key]?.max : undefined}
        step={numeric ? 1 : undefined}
        value={settingText(setting, formData)}
        onChange={(e) => onChange(setting.key, e.target.value)}
        placeholder={
          setting.key === STREAM_LIMIT_KEY
            ? "0 = unlimited"
            : `Enter ${label.toLowerCase()}`
        }
        disabled={disabled}
      />
    </Field>
  );
}
