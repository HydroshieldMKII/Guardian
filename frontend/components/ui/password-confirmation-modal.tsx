"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, Panel } from "@/components/ui/entity";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { Eye, EyeOff } from "lucide-react";

interface PasswordConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
  title: string;
  description: string;
  isLoading?: boolean;
  isDangerous?: boolean;
}

export function PasswordConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  isLoading = false,
  isDangerous = false,
}: PasswordConfirmationModalProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Clear password when modal is closed
  useEffect(() => {
    if (!isOpen) {
      setPassword("");
      setShowPassword(false);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (password.trim()) {
      onConfirm(password);
    }
  };

  const handleClose = () => {
    setPassword("");
    setShowPassword(false);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && password.trim() && !isLoading) {
      handleConfirm();
    }
  };

  return (
    <Modal open={isOpen} onOpenChange={handleClose} size="sm">
      <ModalHeader title={title} description={description} />

      <ModalBody>
        <Field label="Current Password" htmlFor="password">
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter your current password"
              className="pr-10"
              disabled={isLoading}
              autoFocus
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isLoading}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </Button>
          </div>
        </Field>

        {isDangerous && (
          <Panel tone="danger">
            <p className="text-sm leading-relaxed text-rose-700 dark:text-rose-300">
              <strong className="font-semibold">Warning:</strong> This action
              cannot be undone. Please ensure you have exported your database
              before proceeding.
            </p>
          </Panel>
        )}
      </ModalBody>

      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={handleClose}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant={isDangerous ? "destructive" : "default"}
          onClick={handleConfirm}
          disabled={!password.trim() || isLoading}
        >
          {isLoading ? "Confirming..." : "Confirm"}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
