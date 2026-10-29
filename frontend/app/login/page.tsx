"use client";

import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/hooks/use-theme";
import { PageLoader } from "@/components/three-dot-loader";
import { ErrorHandler } from "@/components/error-handler";
import { BrandedAuthPage } from "@/components/auth-form/BrandedAuthPage";
import { LoginForm } from "@/components/login/LoginForm";

export default function LoginPage() {
  const { isLoading, isAuthenticated, backendError, retryConnection } =
    useAuth();
  const { theme } = useTheme();

  if (isLoading) {
    return <PageLoader />;
  }

  if (backendError) {
    return (
      <ErrorHandler
        backendError={backendError}
        onRetry={() => void retryConnection()}
      />
    );
  }

  if (isAuthenticated) {
    return <PageLoader />;
  }

  return (
    <BrandedAuthPage description="Sign in to your account" align="top">
      <LoginForm theme={theme} />
    </BrandedAuthPage>
  );
}
