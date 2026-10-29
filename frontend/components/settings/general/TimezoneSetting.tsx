import { Field } from "@/components/ui/entity";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getSettingInfo } from "../settings-utils";
import { getCurrentTimeInOffset, UTC_OFFSETS } from "./timezones";
import { settingText, type SettingFieldProps } from "./types";

export function TimezoneSetting({
  setting,
  formData,
  onChange,
}: SettingFieldProps) {
  const { label, description } = getSettingInfo(setting);

  return (
    <Field label={label} htmlFor={setting.key} hint={description} inline>
      <Select
        value={settingText(setting, formData)}
        onValueChange={(next) => onChange(setting.key, next)}
      >
        <SelectTrigger
          id={setting.key}
          className="w-full cursor-pointer sm:w-56"
        >
          <SelectValue placeholder="Select timezone" />
        </SelectTrigger>
        <SelectContent>
          {UTC_OFFSETS.map((offset) => (
            <SelectItem key={offset} value={offset}>
              UTC{offset} ({getCurrentTimeInOffset(offset)})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
