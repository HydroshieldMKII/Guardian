"use client";

import { Button } from "@/components/ui/button";
import { toneButton } from "@/components/ui/entity";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { Loader2 } from "lucide-react";

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
  const destructive = variant === "destructive";

  return (
    <Modal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      size="sm"
      nested
    >
      <ModalHeader
        title={title}
        description={
          <span className="block whitespace-pre-line break-words">
            {description}
          </span>
        }
      />

      {children && <ModalBody>{children}</ModalBody>}

      <ModalFooter>
        <Button variant="outline" onClick={() => onClose()} disabled={loading}>
          {cancelText}
        </Button>
        <Button
          variant={destructive ? "outline" : "default"}
          onClick={() => onConfirm()}
          disabled={loading}
          className={destructive ? toneButton("danger") : ""}
        >
          {loading && <Loader2 className="size-4 animate-spin" />}
          {confirmText}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
