import { useEffect, useState } from "react";

interface PasswordResetStatusResponse {
  enabled?: boolean;
  appUrlConfigured?: boolean;
  adminEmailConfigured?: boolean;
}

export function usePasswordResetStatus() {
  const [enabled, setEnabled] = useState(false);
  const [appUrlConfigured, setAppUrlConfigured] = useState(true);
  const [anyAdminEmail, setAnyAdminEmail] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const response = await fetch("/api/pg/auth/password-reset/status");
        if (response.ok) {
          const data = (await response.json()) as PasswordResetStatusResponse;
          setEnabled(Boolean(data.enabled));
          setAppUrlConfigured(Boolean(data.appUrlConfigured));
          setAnyAdminEmail(Boolean(data.adminEmailConfigured));
        }
      } catch (error) {
        console.error("Failed to check password reset status:", error);
      }
    };

    void check();
  }, []);

  return { enabled, appUrlConfigured, anyAdminEmail };
}
