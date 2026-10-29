"use client";

import { useAuth } from "@/contexts/auth-context";
import { PageLoader } from "@/components/three-dot-loader";
import { ErrorHandler } from "@/components/error-handler";
import { BrandedAuthPage } from "@/components/auth-form/BrandedAuthPage";
import { SetupForm } from "@/components/setup/SetupForm";

export default function SetupPage() {
  const { isLoading, setupRequired, backendError, retryConnection } = useAuth();

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

  if (!setupRequired) {
    return null;
  }

  return (
    <BrandedAuthPage description="Create your admin account to get started">
      <SetupForm />
    </BrandedAuthPage>
  );
}
