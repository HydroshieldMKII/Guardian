import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/auth-context";
import { useLoginForm } from "@/hooks/login/useLoginForm";
import { useTurnstile } from "@/hooks/login/useTurnstile";
import { usePasswordResetStatus } from "@/hooks/usePasswordResetStatus";
import { usePlexOAuth } from "@/hooks/use-plex-oauth";
import { AuthInput } from "@/components/auth-form/AuthInput";
import { PasswordInput } from "@/components/auth-form/PasswordInput";
import { ForgotPasswordLink } from "./ForgotPasswordLink";
import { LoginErrorAlert } from "./LoginErrorAlert";
import { LOGIN_PLEX_COPY } from "./plex-copy";
import { PlexSignIn } from "./PlexSignIn";

export function LoginForm({ theme }: { theme: string }) {
  const { login, loginWithPlex, plexOAuthEnabled } = useAuth();
  const { enabled: passwordResetEnabled } = usePasswordResetStatus();
  const {
    siteKey: turnstileSiteKey,
    containerRef: turnstileRef,
    token: captchaToken,
    reset: resetCaptcha,
  } = useTurnstile(theme);
  const form = useLoginForm({
    login,
    captchaToken,
    onFailure: resetCaptcha,
  });
  const plex = usePlexOAuth({
    redirectWhenPopupIsUnavailable: true,
    onAuthenticated: loginWithPlex,
    copy: LOGIN_PLEX_COPY,
  });
  const busy = form.isSubmitting || plex.loading;

  return (
    <>
      <form onSubmit={(e) => void form.submit(e)} className="space-y-4">
        <AuthInput
          id="username"
          label="Username or Email"
          icon={User}
          type="text"
          placeholder="Enter username or email"
          value={form.values.username}
          onChange={(e) => form.change("username", e.target.value)}
          disabled={form.isSubmitting}
          autoComplete="username"
          error={form.errors.username}
        />

        <PasswordInput
          id="password"
          label="Password"
          placeholder="Enter your password"
          value={form.values.password}
          onChange={(e) => form.change("password", e.target.value)}
          disabled={form.isSubmitting}
          autoComplete="current-password"
          error={form.errors.password}
          footer={passwordResetEnabled && <ForgotPasswordLink />}
        />

        {turnstileSiteKey && (
          <div className="flex justify-center">
            <div ref={turnstileRef}></div>
          </div>
        )}

        <LoginErrorAlert message={form.loginError} />

        <Button type="submit" disabled={busy} className="w-full mt-2" size="lg">
          {form.isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>

      {plexOAuthEnabled && (
        <PlexSignIn
          loading={plex.loading}
          waiting={plex.waiting}
          disabled={busy}
          onStart={() => void plex.start()}
          onCancel={() => plex.cancel()}
        />
      )}
    </>
  );
}
