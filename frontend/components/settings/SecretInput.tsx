"use client";

import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getSecretInputDisplay } from "@/components/settings/settings-utils";
import type { AppSetting } from "@/types";

interface SecretInputProps {
  setting: AppSetting;
  value: string;
  placeholder: string;
  type: string;
  onChange: (value: string) => void;
}

export function SecretInput({
  setting,
  value,
  placeholder,
  type,
  onChange,
}: SecretInputProps) {
  const display = getSecretInputDisplay(setting, value, placeholder);
  const canClear = value !== "";

  return (
    <div className="relative">
      <Input
        id={setting.key}
        type={type}
        value={display.value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={display.placeholder}
        className={`cursor-pointer ${canClear ? "pr-9" : ""}`}
      />
      {canClear && (
        <button
          type="button"
          aria-label={`Clear ${setting.key}`}
          title="Clear this value"
          onClick={() => onChange("")}
          className="absolute inset-y-0 right-0 flex w-9 cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
