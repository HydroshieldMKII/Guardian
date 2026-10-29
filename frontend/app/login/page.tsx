"use client";

import { useAuth } from "@/contexts/auth-context";
import { LogoMark } from "@/components/ui/logo-mark";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTheme } from "@/hooks/use-theme";
import { PageLoader } from "@/components/three-dot-loader";
import { ErrorHandler } from "@/components/error-handler";
import { LoginForm } from "@/components/login/LoginForm";
import { LoginThemeToggle } from "@/components/login/LoginThemeToggle";

export default function LoginPage() {
  const { isLoading, isAuthenticated, backendError, retryConnection } =
    useAuth();
  const { theme, toggleTheme } = useTheme();

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
    return null;
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-b from-background to-muted p-4 overflow-hidden relative">
      <LoginThemeToggle theme={theme} onToggle={toggleTheme} />

      <Card className="w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="space-y-1 text-center pb-6 pt-8">
          <CardTitle className="flex items-center justify-center gap-3 text-3xl font-bold">
            <LogoMark className="h-9 w-auto" />
            Guardian
          </CardTitle>
          <CardDescription className="text-sm">
            Sign in to your account
          </CardDescription>
        </CardHeader>

        <CardContent className="pb-6">
          <LoginForm theme={theme} />
        </CardContent>
      </Card>
    </div>
  );
}
