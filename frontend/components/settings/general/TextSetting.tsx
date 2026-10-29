import { Field } from "@/components/ui/entity";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getSettingInfo } from "../settings-utils";
import { NUMBER_MIN } from "./sections";
import { settingText, type SettingFieldProps } from "./types";

const STREAM_LIMIT_KEY = "CONCURRENT_STREAM_LIMIT";

export function TextSetting({
  setting,
  formData,
  onChange,
  disabled,
}: SettingFieldProps) {
  const { label, description } = getSettingInfo(setting);
  const numeric =
    setting.type === "number" ||
    setting.key.includes("INTERVAL") ||
    setting.key === STREAM_LIMIT_KEY;

  return (
    <Field
      label={label}
      htmlFor={setting.key}
      hint={description}
      inline={numeric}
      className={cn(
        "transition-opacity duration-200",
        disabled && "opacity-60",
      )}
    >
      <Input
        id={setting.key}
        type={numeric ? "number" : "text"}
        className={numeric ? "w-full tabular-nums sm:w-28" : undefined}
        min={numeric ? NUMBER_MIN[setting.key] : undefined}
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
