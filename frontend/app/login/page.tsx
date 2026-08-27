"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTheme } from "@/hooks/use-theme";
import {
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  Sun,
  Moon,
  Loader2,
} from "lucide-react";
import { ThreeDotLoader } from "@/components/three-dot-loader";
import { ErrorHandler } from "@/components/error-handler";
import { usePlexOAuth } from "@/hooks/use-plex-oauth";

// Extend window to include turnstile
declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: any) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
      getResponse: (widgetId: string) => string;
    };
  }
}

export default function LoginPage() {
  const {
    login,
    loginWithPlex,
    isLoading,
    isAuthenticated,
    backendError,
    retryConnection,
    plexOAuthEnabled,
  } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loginError, setLoginError] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);

  const [passwordResetEnabled, setPasswordResetEnabled] = useState(false);

  // Cloudflare Turnstile state
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string>("");
  const [turnstileWidgetId, setTurnstileWidgetId] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);

  // Fetch Turnstile site key
  useEffect(() => {
    const fetchTurnstileKey = async () => {
      try {
        const response = await fetch("/api/pg/auth/turnstile-key");
        if (response.ok) {
          const data = await response.json();
          if (data.siteKey) {
            setTurnstileSiteKey(data.siteKey);
          }
        }
      } catch (error) {
        console.error("Failed to fetch Turnstile site key:", error);
      }
    };

    fetchTurnstileKey();
  }, []);

  useEffect(() => {
    const checkPasswordReset = async () => {
      try {
        const response = await fetch("/api/pg/auth/password-reset/status");
        if (response.ok) {
          const data = await response.json();
          setPasswordResetEnabled(Boolean(data.enabled));
        }
      } catch (error) {
        console.error("Failed to check password reset status:", error);
      }
    };

    checkPasswordReset();
  }, []);

  // Load Turnstile script and render widget
  useEffect(() => {
    if (!turnstileSiteKey || !turnstileRef.current) return;

    const scriptId = "turnstile-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const renderTurnstile = () => {
      if (window.turnstile && turnstileRef.current && !turnstileWidgetId) {
        const widgetId = window.turnstile.render(turnstileRef.current, {
          sitekey: turnstileSiteKey,
          theme: theme === "dark" ? "dark" : "light",
        });
        setTurnstileWidgetId(widgetId);
      }
    };

    if (window.turnstile) {
      // Turnstile already loaded
      renderTurnstile();
    } else {
      // Wait for script to load
      script.addEventListener("load", renderTurnstile);
    }

    return () => {
      if (turnstileWidgetId && window.turnstile) {
        window.turnstile.remove(turnstileWidgetId);
        setTurnstileWidgetId(null);
      }
    };
  }, [turnstileSiteKey, theme]);

  const {
    loading: plexLoading,
    waiting: plexWaiting,
    start: handlePlexLogin,
    cancel: cancelPlexLogin,
  } = usePlexOAuth({
    redirectWhenPopupIsUnavailable: true,
    onAuthenticated: loginWithPlex,
    copy: {
      success: {
        title: "Signed In",
        description: "You are signed in with Plex",
      },
      failed: {
        title: "Plex Sign-In Failed",
        description: "Guardian could not sign you in with Plex",
      },
      expired: {
        title: "Plex Sign-In Expired",
        description: "The sign-in window timed out. Start again to retry.",
      },
      cancelled: {
        title: "Plex Sign-In Cancelled",
        description: "The Plex window closed before you signed in",
      },
    },
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.username) {
      newErrors.username = "Username or email is required";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear errors when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
    if (loginError) {
      setLoginError("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setLoginError("");
    try {
      // Get captcha token if Turnstile is enabled
      let captchaToken: string | undefined;
      if (turnstileWidgetId && window.turnstile) {
        captchaToken = window.turnstile.getResponse(turnstileWidgetId);
      }

      await login(formData.username, formData.password, captchaToken);

      // AuthGuard handle it once state updates
    } catch (error) {
      // Reset Turnstile widget on error
      if (turnstileWidgetId && window.turnstile) {
        window.turnstile.reset(turnstileWidgetId);
      }

      setLoginError(
        error instanceof Error ? error.message : "Invalid credentials"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loader while checking auth
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ThreeDotLoader />
      </div>
    );
  }

  // Show error if backend is unavailable
  if (backendError) {
    return (
      <ErrorHandler backendError={backendError} onRetry={retryConnection} />
    );
  }

  // Don't render form if already authenticated
  if (isAuthenticated) {
    return null;
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-b from-background to-muted p-4 overflow-hidden relative">
      {/* Theme Toggle Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleTheme}
        className="absolute top-4 right-4 h-9 w-9 p-0 hover:bg-accent/50 z-10"
      >
        {theme === "dark" ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
        <span className="sr-only">Toggle theme</span>
      </Button>

      <Card className="w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="space-y-1 text-center pb-6 mt-4">
          <CardTitle className="text-3xl font-bold">Guardian</CardTitle>
          <CardDescription className="text-sm">
            Sign in to your account
          </CardDescription>
        </CardHeader>

        <CardContent className="pb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username/Email */}
            <div className="space-y-2">
              <label
                htmlFor="username"
                className="text-sm font-semibold text-foreground"
              >
                Username or Email
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="Enter username or email"
                  value={formData.username}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  autoComplete="username"
                  className={`pl-10 ${errors.username ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
              </div>
              {errors.username && (
                <div className="flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle className="h-3 w-3" />
                  {errors.username}
                </div>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-semibold text-foreground"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  autoComplete="current-password"
                  className={`pl-10 pr-10 ${errors.password ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isSubmitting}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <div className="flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle className="h-3 w-3" />
                  {errors.password}
                </div>
              )}
              {passwordResetEnabled && (
                <div className="text-right">
                  <Link
                    href="/forgot-password"
                    className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              )}
            </div>

            {/* Cloudflare Turnstile Captcha */}
            {turnstileSiteKey && (
              <div className="flex justify-center">
                <div ref={turnstileRef}></div>
              </div>
            )}

            {/* Login Error */}
            {loginError && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
                <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-600 dark:text-red-500">
                  {loginError}
                </p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting || plexLoading}
              className="w-full mt-2"
              size="lg"
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          {/* Plex OAuth Button - only show if enabled */}
          {plexOAuthEnabled && (
            <>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting || plexLoading}
                onClick={handlePlexLogin}
                className="w-full !bg-[#e5a00d] hover:!bg-[#cc8f0c] !text-black !border-[#e5a00d] hover:!border-[#cc8f0c]"
                size="lg"
              >
                {plexLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Waiting for Plex...
                  </>
                ) : (
                  <>
                    <img
                      src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAACXBIWXMAAAsTAAALEwEAmpwYAAADDklEQVR4nO2dPWxOURjHfz5S7UCURKiEsEiYDBYGs8FKLKiOEiaCdjBZWEzslXTSdmqYDa2PVGLwObVdJE20vBUaH0eOXBOGc3M+nnvf/y/57//n+ee97733POdcEEIIIYQQQgghhBAinC3AOWASeA2sAK4lWqlqmgAGgX4M0QcMAx8NNMpl0jJwtaq9KAPAEwMNcYX0HNhVqvk7gQUDTXCFtVD1Iiv+p/fMQPHOiPxVoDdnACMGinbGdCXn3c6ygYKdMS3lujsaMlCsM6qzOQKYNFCoM6rxHAG8M1CoMyr/sJacjoFCnVH53iSndJHOuBQACqCrlZzUBYwBewN1w0DjWxPAD+BwoKf1wKyB5rciAAe8AHoCfR0EvimAeBqp4e2mAoinr8D+QG8bgJcKIJ6mgbWB/o4CPxVAPJ2v4fGOAoi7IL4n0OMmYE4BxNNUDZ/HFEBcnarhdVQBxNMisC3Q61bgvQKIp9Eafk8ogLg6XsPzfQUQT3PAxkDP24EPCiCebtfw7edWFUDEN6ZHanh/oADi6VWNabTdwCcFEE/Xa/i/oADiaRU4EOjfv9x7pADiaQZYF1jDPuCLAiCa/GUllGsKgGj6XC3Oh64jpxixT07pZjsF0I5L0HAiL8lxxjSjP+FyWtVtaPMexC4m9pQc1/BXER0FUOZl3BrgYQZvyXENfR09lMlbcpq4ILNDCzJllyTHM/pLTtMW5U9m9picUs1f1FhK8waz7hXwmZwSzZ+q4VOjiYWHc+cVQLnx9LuFmt+6AKa1QeNvLG9R6gPeFmy+6/ZNercKN7+rt6keAr4rgDIbtXuq0Eo3vxUBjOmogrIBuIZLAaAAulrJ0ZFl/Ff+/OzkvDFQqDMqPyiQnAkDhTqj8psBkzNooFBnVKdzBOCP59XRxfzz6OLNZCLVbL1rsC6RET+R9tRA0c6IHuc+vt6jDzjwW/PVl0SKMFCl77pUsyU/YfKH3urjBUsGGuIyydd6uTqjzgz91fn549UDSZuemDtVTb62MznvdoQQQgghhBBCCCEEreEXCfyL3FOHoLAAAAAASUVORK5CYII="
                      alt="Plex"
                      className="mr-2 h-5 w-5"
                    />
                    Sign in with Plex
                  </>
                )}
              </Button>

              {plexWaiting && (
                <div className="mt-3 space-y-2 text-center">
                  <p className="text-xs text-muted-foreground">
                    Finish signing in on the Plex window. Guardian closes it for
                    you once Plex confirms.
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => cancelPlexLogin()}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Cancel Plex sign-in
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
