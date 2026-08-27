"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
} from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThreeDotLoader } from "@/components/three-dot-loader";
import {
  PASSWORD_RULE_LABELS,
  getPasswordRequirements,
  isStrongPassword,
} from "@/lib/password-rules";

type Stage = "checking" | "invalid" | "form" | "done";

function ResetPasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [stage, setStage] = useState<Stage>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setStage("invalid");
      return;
    }

    const verify = async () => {
      try {
        const response = await fetch("/api/pg/auth/password-reset/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = response.ok
          ? ((await response.json()) as { valid?: boolean })
          : { valid: false };
        setStage(data.valid ? "form" : "invalid");
      } catch {
        setStage("invalid");
      }
    };

    void verify();
  }, [token]);

  const requirements = getPasswordRequirements(password);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!isStrongPassword(password)) {
      setError("Your password must meet every requirement listed below");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/pg/auth/password-reset/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          message?: string | string[];
        };
        const message = Array.isArray(body.message)
          ? body.message[0]
          : body.message;
        throw new Error(message || "Guardian could not set the new password");
      }

      setStage("done");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Guardian could not set the new password",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (stage === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <ThreeDotLoader />
      </div>
    );
  }

  if (stage === "invalid") {
    return (
      <AuthShell
        title="Link Expired"
        description="This reset link no longer works"
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          Reset links last 15 minutes and work once. Ask for a new one to try
          again.
        </p>
        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/forgot-password"
            className="text-primary hover:underline"
          >
            Request a new link
          </Link>
        </p>
      </AuthShell>
    );
  }

  if (stage === "done") {
    return (
      <AuthShell
        title="Password Changed"
        description="Sign in with your new password"
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          Every other session was signed out, so any device that was still
          logged in has to sign in again.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a Password"
      description="Set a new password for your Guardian account"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="password"
            className="text-sm font-semibold text-foreground"
          >
            New password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Minimum 12 characters"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              disabled={submitting}
              className="pl-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={submitting}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-3 text-muted-foreground transition-colors hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="size-4" />
              ) : (
                <Eye className="size-4" />
              )}
            </button>
          </div>
        </div>

        <div className="space-y-1.5 rounded-md border bg-muted/40 p-3">
          {PASSWORD_RULE_LABELS.map(({ key, label }) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              {requirements[key] ? (
                <CheckCircle2 className="size-3 text-emerald-600" />
              ) : (
                <div className="size-3 rounded-full border border-muted-foreground" />
              )}
              <span
                className={
                  requirements[key]
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-muted-foreground"
                }
              >
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <label
            htmlFor="confirmPassword"
            className="text-sm font-semibold text-foreground"
          >
            Confirm new password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Repeat the new password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                setError("");
              }}
              disabled={submitting}
              className="pl-10"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/20">
            <AlertCircle className="size-4 shrink-0 text-red-600 dark:text-red-500" />
            <p className="text-sm text-red-600 dark:text-red-500">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          size="lg"
          disabled={submitting}
          className="w-full"
        >
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {submitting ? "Saving..." : "Set New Password"}
        </Button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <ThreeDotLoader />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
