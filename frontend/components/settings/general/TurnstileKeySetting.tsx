import { Field } from "@/components/ui/entity";
import { SecretInput } from "../SecretInput";
import { getSettingInfo } from "../settings-utils";
import { settingText, type SettingFieldProps } from "./types";

export const TURNSTILE_SITE_KEY = "CLOUDFLARE_TURNSTILE_SITE_KEY";
export const TURNSTILE_SECRET_KEY = "CLOUDFLARE_TURNSTILE_SECRET_KEY";

export function TurnstileKeySetting({
  setting,
  formData,
  onChange,
}: SettingFieldProps) {
  const { label, description } = getSettingInfo(setting);
  const isSiteKey = setting.key === TURNSTILE_SITE_KEY;

  return (
    <Field
      label={label}
      htmlFor={setting.key}
      hint={
        isSiteKey ? (
          <>
            {description}. Get your Turnstile keys from{" "}
            <a
              href="https://dash.cloudflare.com/sign-up?to=/:account/turnstile"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Cloudflare Turnstile
            </a>
            .
          </>
        ) : (
          description
        )
      }
    >
      <SecretInput
        setting={setting}
        value={settingText(setting, formData)}
        placeholder={`Enter ${label.toLowerCase()}`}
        type={isSiteKey ? "text" : "password"}
        onChange={(next) => onChange(setting.key, next)}
      />
    </Field>
  );
}
