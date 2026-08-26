"use client";

import * as React from "react";
import { SecretInput } from "@/components/settings/SecretInput";
import {
  Field,
  Panel,
  StatusPill,
  ToggleRow,
  type Tone,
} from "@/components/ui/entity";
import { cn } from "@/lib/utils";
import { getSettingInfo, SettingsFormData } from "./settings-utils";
import type { AppSetting } from "@/types";

export function SettingsCard({
  title,
  description,
  action,
  footer,
  className,
  children,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn("overflow-hidden rounded-xl border bg-card", className)}
    >
      <div className="flex items-start justify-between gap-4 border-b px-4 py-4 sm:px-6 sm:py-5">
        <div className="min-w-0 space-y-1">
          <h2 className="text-base font-semibold leading-tight tracking-tight text-foreground">
            {title}
          </h2>
          {description && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="space-y-5 px-4 py-5 sm:px-6">{children}</div>
      {footer && <div className="border-t px-4 py-4 sm:px-6">{footer}</div>}
    </section>
  );
}

export function ActionRow({
  title,
  description,
  action,
  tone = "neutral",
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <Panel
      tone={tone}
      className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{action}</div>
    </Panel>
  );
}

export function Banner({
  tone,
  className,
  children,
}: {
  tone: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  const text: Record<Tone, string> = {
    neutral: "text-muted-foreground",
    positive: "text-emerald-700 dark:text-emerald-300",
    warning: "text-amber-700 dark:text-amber-300",
    danger: "text-rose-700 dark:text-rose-300",
    info: "text-sky-700 dark:text-sky-300",
    accent: "text-violet-700 dark:text-violet-300",
  };

  return (
    <Panel tone={tone} className={cn("py-3", className)}>
      <p className={cn("text-sm leading-relaxed", text[tone])}>{children}</p>
    </Panel>
  );
}

export function isTruthy(value: string | boolean | number | undefined) {
  return value === true || value === "true";
}

export function SettingControl({
  setting,
  formData,
  onChange,
  disabled,
  className,
}: {
  setting: AppSetting;
  formData: SettingsFormData;
  onChange: (key: string, value: string | boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const { label, description, optional } = getSettingInfo(setting);
  const value = formData[setting.key] ?? setting.value;

  if (setting.type === "boolean") {
    return (
      <ToggleRow
        id={setting.key}
        label={label}
        hint={description}
        checked={isTruthy(value)}
        onCheckedChange={(checked) => onChange(setting.key, checked)}
        disabled={disabled}
        className={className}
      />
    );
  }

  return (
    <Field
      label={label}
      htmlFor={setting.key}
      hint={description}
      action={
        optional ? <StatusPill tone="neutral">Optional</StatusPill> : undefined
      }
      className={className}
    >
      <SecretInput
        setting={setting}
        value={typeof value === "string" ? value : String(value)}
        placeholder={`Enter ${label.toLowerCase()}`}
        type={
          setting.key.includes("PASSWORD") || setting.key.includes("TOKEN")
            ? "password"
            : "text"
        }
        onChange={(next) => onChange(setting.key, next)}
      />
    </Field>
  );
}
