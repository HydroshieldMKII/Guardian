import { useEffect, useState } from "react";

interface PasswordResetStatus {
  appUrlConfigured?: boolean;
  adminEmailConfigured?: boolean;
}

export function usePasswordResetStatus() {
  const [appUrlConfigured, setAppUrlConfigured] = useState(true);
  const [anyAdminEmail, setAnyAdminEmail] = useState(true);

  useEffect(() => {
    const check = async () => {
      try {
        const response = await fetch("/api/pg/auth/password-reset/status");
        if (response.ok) {
          const data = (await response.json()) as PasswordResetStatus;
          setAppUrlConfigured(Boolean(data.appUrlConfigured));
          setAnyAdminEmail(Boolean(data.adminEmailConfigured));
        }
      } catch (error) {
        console.error("Failed to check password reset status:", error);
      }
    };

    void check();
  }, []);

  return { appUrlConfigured, anyAdminEmail };
}
