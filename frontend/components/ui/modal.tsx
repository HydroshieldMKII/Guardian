"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type ModalSize = "sm" | "md" | "lg" | "xl";

const SIZE: Record<ModalSize, string> = {
  sm: "sm:max-w-md",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-3xl",
};

export function Modal({
  open,
  onOpenChange,
  size = "md",
  nested = false,
  className,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  size?: ModalSize;
  nested?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName={nested ? "z-[999999] bg-black/70" : undefined}
        className={cn(
          "flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 pb-0 sm:max-h-[85vh] sm:gap-0 sm:p-0",
          SIZE[size],
          nested && "z-[999999]",
          className,
        )}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function ModalHeader({
  title,
  titleHidden = false,
  titleSuffix,
  description,
  className,
  children,
}: {
  title: React.ReactNode;
  titleHidden?: boolean;
  titleSuffix?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}) {
  const heading = (
    <DialogTitle
      className={
        titleHidden
          ? "sr-only"
          : "min-w-0 truncate text-base font-semibold leading-tight tracking-tight text-foreground sm:text-lg"
      }
    >
      {title}
    </DialogTitle>
  );

  return (
    <DialogHeader
      className={cn(
        "shrink-0 gap-1.5 border-b px-4 py-4 sm:px-6 sm:py-5",
        className,
      )}
    >
      {titleSuffix ? (
        <div className="flex flex-wrap items-center gap-2">
          {heading}
          {titleSuffix}
        </div>
      ) : (
        heading
      )}
      {description ? (
        <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </DialogDescription>
      ) : (
        <DialogDescription className="sr-only">{title}</DialogDescription>
      )}
      {children}
    </DialogHeader>
  );
}

export function ModalBody({
  className,
  children,
  ref,
}: {
  className?: string;
  children: React.ReactNode;
  ref?: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      className={cn(
        "scrollbar-visible min-h-0 flex-1 space-y-5 overflow-y-auto overflow-x-hidden px-4 py-5 sm:px-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ModalFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "shrink-0 gap-2 border-t px-4 py-4 sm:px-6",
        "flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end",
        "[&>button]:w-full sm:[&>button]:w-auto",
        className,
      )}
    >
      {children}
    </div>
  );
}
