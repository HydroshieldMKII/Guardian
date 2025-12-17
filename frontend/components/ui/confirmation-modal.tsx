"use client";

import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogPortal,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  children?: React.ReactNode;
  loading?: boolean;
}

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "Continue",
  cancelText = "Cancel",
  variant = "default",
  children,
  loading = false,
}: ConfirmationModalProps) {
  const handleConfirm = () => {
    onConfirm();
    // Don't call onClose here since the parent should handle closing
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} modal>
      <DialogPortal>
        <DialogPrimitive.Overlay
          className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 bg-black/70"
          style={{ zIndex: 999999 }}
        />
        <DialogPrimitive.Content
          className="bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed grid w-full border shadow-2xl duration-200 bottom-0 left-0 right-0 max-h-[85vh] rounded-t-xl p-4 pb-6 gap-3 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:bottom-auto sm:left-[50%] sm:right-auto sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%] sm:max-w-[425px] sm:max-h-[90vh] sm:rounded-lg sm:p-6 sm:gap-4 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:zoom-in-95 overflow-y-auto"
          style={{ zIndex: 999999 }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {variant === "destructive" && (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              )}
              {title}
            </DialogTitle>
            <DialogDescription className="text-left whitespace-pre-line">
              {description}
            </DialogDescription>
          </DialogHeader>

          {children && <div className="py-4">{children}</div>}

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={loading}>
              {cancelText}
            </Button>
            <Button
              variant={variant === "destructive" ? "outline" : "default"}
              onClick={handleConfirm}
              disabled={loading}
              className={
                variant === "destructive"
                  ? "border-red-600 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-700 dark:hover:bg-red-900/20"
                  : ""
              }
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {confirmText}
            </Button>
          </DialogFooter>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
