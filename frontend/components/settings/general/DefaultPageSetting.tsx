import { Field, SegmentedControl } from "@/components/ui/entity";
import { getSettingInfo } from "../settings-utils";
import { settingText, type SettingFieldProps } from "./types";

export function DefaultPageSetting({
  setting,
  formData,
  onChange,
}: SettingFieldProps) {
  const { label, description } = getSettingInfo(setting);

  return (
    <Field label={label} hint={description} inline>
      <SegmentedControl
        value={settingText(setting, formData)}
        onChange={(next) => onChange(setting.key, next)}
        options={[
          { value: "devices", label: "Users" },
          { value: "streams", label: "Streams" },
        ]}
      />
    </Field>
  );
}
