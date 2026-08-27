"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, RefreshCw, type LucideIcon } from "lucide-react";
import { toneMenuItem, type Tone } from "@/components/ui/entity";
import { cn } from "@/lib/utils";

export interface Action {
  label: string;
  icon: LucideIcon;
  tone?: Tone;
  disabled?: boolean;
  onSelect: () => void;
}

const TRIGGER_SIZE = {
  compact: "size-8 px-0",
  responsive: "h-10 w-full rounded-md lg:size-8 lg:px-0",
};

export function ActionMenu({
  actions,
  destructive,
  busy = false,
  trigger = "compact",
  className,
}: {
  actions: Action[];
  destructive?: Action;
  busy?: boolean;
  trigger?: keyof typeof TRIGGER_SIZE;
  className?: string;
}) {
  const item = ({
    label,
    icon: Icon,
    tone = "neutral",
    disabled,
    onSelect,
  }: Action) => (
    <DropdownMenuItem
      key={label}
      onSelect={onSelect}
      disabled={disabled}
      className={toneMenuItem(tone)}
    >
      <Icon />
      {label}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          className={cn(TRIGGER_SIZE[trigger], className)}
        >
          <span className={trigger === "compact" ? "sr-only" : "lg:sr-only"}>
            Actions
          </span>
          {busy ? (
            <RefreshCw className="size-4 animate-spin" />
          ) : (
            <MoreVertical />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {actions.map(item)}
        {destructive && (
          <>
            <DropdownMenuSeparator />
            {item(destructive)}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
