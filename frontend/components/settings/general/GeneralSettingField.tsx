import type { AppSetting } from "@/types";
import { SettingControl } from "../settings-ui";
import { DefaultPageSetting } from "./DefaultPageSetting";
import { PasswordResetSetting } from "./PasswordResetSetting";
import { TextSetting } from "./TextSetting";
import { TimezoneSetting } from "./TimezoneSetting";
import {
  TURNSTILE_SECRET_KEY,
  TURNSTILE_SITE_KEY,
  TurnstileKeySetting,
} from "./TurnstileKeySetting";
import type { SettingFieldProps } from "./types";

export function GeneralSettingField({
  settings,
  ...props
}: SettingFieldProps & { settings: AppSetting[] }) {
  switch (props.setting.key) {
    case "PASSWORD_RESET_ENABLED":
      return <PasswordResetSetting {...props} settings={settings} />;
    case "TIMEZONE":
      return <TimezoneSetting {...props} />;
    case "DEFAULT_PAGE":
      return <DefaultPageSetting {...props} />;
    case TURNSTILE_SITE_KEY:
    case TURNSTILE_SECRET_KEY:
      return <TurnstileKeySetting {...props} />;
  }

  return props.setting.type === "boolean" ? (
    <SettingControl {...props} />
  ) : (
    <TextSetting {...props} />
  );
}
