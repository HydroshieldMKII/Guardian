"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Mail } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThreeDotLoader } from "@/components/three-dot-loader";

type Stage = "checking" | "unavailable" | "form" | "sent";

export default function ForgotPasswordPage() {
  const [stage, setStage] = useState<Stage>("checking");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const response = await fetch("/api/pg/auth/password-reset/status");
        const data = response.ok
          ? ((await response.json()) as { enabled?: boolean })
          : { enabled: false };
        setStage(data.enabled ? "form" : "unavailable");
      } catch {
        setStage("unavailable");
      }
    };

    void check();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!email.trim()) {
      setError("Enter the email address on your account");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/pg/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          message?: string;
        };
        throw new Error(body.message || "Could not send the email");
      }

      setStage("sent");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not send the email",
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

  if (stage === "unavailable") {
    return (
      <AuthShell
        title="Password Reset"
        description="This server does not offer password resets"
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          Ask the server owner to turn password resets on in Settings. It needs
          email notifications configured and the server address set through the
          APP_URL environment variable.
        </p>
      </AuthShell>
    );
  }

  if (stage === "sent") {
    return (
      <AuthShell
        title="Check Your Email"
        description="A reset link is on its way if the address is registered"
      >
        <p className="text-sm leading-relaxed text-muted-foreground">
          Whether an account uses that address is never disclosed. If one does,
          the link arrives shortly and works for 15 minutes.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot Password"
      description="Enter your email to be sent a reset link"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label
            htmlFor="email"
            className="text-sm font-semibold text-foreground"
          >
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="Enter your account email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
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
          {submitting ? "Sending..." : "Send Reset Link"}
        </Button>
      </form>
    </AuthShell>
  );
}
