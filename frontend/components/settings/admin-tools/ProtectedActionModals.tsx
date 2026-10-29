import { ConfirmationModal } from "@/components/ui/confirmation-modal";
import { PasswordConfirmationModal } from "@/components/ui/password-confirmation-modal";
import type { useProtectedActions } from "@/hooks/settings/useProtectedActions";
import type { ProtectedAction } from "./protected-actions";

interface ProtectedActionModalsProps {
  actions: ProtectedAction[];
  flow: ReturnType<typeof useProtectedActions>;
}

export function ProtectedActionModals({
  actions,
  flow,
}: ProtectedActionModalsProps) {
  const { confirming, authorizing, busy } = flow;
  return (
    <>
      {actions.map((action) => (
        <ConfirmationModal
          key={action.key}
          isOpen={confirming?.key === action.key}
          onClose={flow.cancelConfirm}
          onConfirm={flow.askPassword}
          title={action.title}
          description={action.confirm.description}
          confirmText={action.confirm.confirmText}
          cancelText="Cancel"
          variant={action.confirm.variant}
        />
      ))}
      <PasswordConfirmationModal
        isOpen={authorizing !== null}
        onClose={flow.cancelPassword}
        onConfirm={(password) => void flow.run(password)}
        title={authorizing?.title ?? "Confirm action"}
        description={
          authorizing?.password.description ??
          "Please enter your password to continue."
        }
        isDangerous={authorizing?.password.isDangerous}
        isLoading={busy !== null}
      />
    </>
  );
}
