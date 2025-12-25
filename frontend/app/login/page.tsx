"use client";

import { useState, useEffect, useCallback } from "react";
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
import { useToast } from "@/hooks/use-toast";
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

// Plex OAuth constants
const PLEX_AUTH_URL = "https://app.plex.tv/auth";
const PIN_CHECK_INTERVAL = 2000; // 2 seconds

interface PlexPin {
  id: number;
  code: string;
  clientId: string;
  expiresAt: string;
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
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();

  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

  // Plex OAuth state
  const [plexLoading, setPlexLoading] = useState(false);
  const [plexPin, setPlexPin] = useState<PlexPin | null>(null);
  const [plexPopup, setPlexPopup] = useState<Window | null>(null);

  // Check Plex PIN status
  const checkPlexPin = useCallback(async () => {
    if (!plexPin) return;

    try {
      const response = await fetch(`/api/pg/auth/plex/pin/${plexPin.clientId}`);
      if (!response.ok) return;

      const data = await response.json();

      if (data.authToken) {
        // User authenticated with Plex
        setPlexLoading(true);

        try {
          await loginWithPlex(data.authToken);
          toast({
            title: "Success",
            description: "Logged in with Plex successfully",
            variant: "success",
          });
        } catch (error) {
          toast({
            title: "Login Failed",
            description:
              error instanceof Error ? error.message : "Plex login failed",
            variant: "destructive",
          });
        } finally {
          setPlexLoading(false);
          setPlexPin(null);
        }
      }
    } catch (error) {
      console.error("Failed to check Plex PIN:", error);
    }
  }, [plexPin, loginWithPlex, toast]);

  // Poll for Plex PIN completion
  useEffect(() => {
    if (!plexPin) return;

    const interval = setInterval(checkPlexPin, PIN_CHECK_INTERVAL);

    // Check if PIN has expired
    const expiresAt = new Date(plexPin.expiresAt);
    const timeout = setTimeout(() => {
      setPlexPin(null);
      setPlexLoading(false);
      toast({
        title: "Plex Login Expired",
        description: "Please try again",
        variant: "destructive",
      });
    }, expiresAt.getTime() - Date.now());

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [plexPin, checkPlexPin, toast]);

  // Close popup when done
  useEffect(() => {
    if (!plexPin && plexPopup && !plexPopup.closed) {
      plexPopup.close();
      setPlexPopup(null);
    }
  }, [plexPin, plexPopup]);

  // Check for stored Plex PIN on mount (mobile redirect flow)
  useEffect(() => {
    const storedPin = sessionStorage.getItem("plexPin");
    if (storedPin) {
      try {
        const pinData: PlexPin = JSON.parse(storedPin);
        // Check if PIN hasn't expired
        if (new Date(pinData.expiresAt) > new Date()) {
          setPlexPin(pinData);
          setPlexLoading(true);
          // Immediate check since user just returned from Plex
          setTimeout(() => {
            sessionStorage.removeItem("plexPin");
          }, 100);
        } else {
          sessionStorage.removeItem("plexPin");
        }
      } catch {
        sessionStorage.removeItem("plexPin");
      }
    }
  }, []);

  const handlePlexLogin = async () => {
    setPlexLoading(true);

    try {
      // Create PIN
      const response = await fetch("/api/pg/auth/plex/pin", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to create Plex PIN");
      }

      const pinData: PlexPin = await response.json();
      setPlexPin(pinData);

      // Open Plex auth popup
      const authUrl = `${PLEX_AUTH_URL}#?clientID=${pinData.clientId}&code=${pinData.code}&context%5Bdevice%5D%5Bproduct%5D=Guardian`;

      // Check if mobile device - use redirect instead of popup
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (isMobile) {
        // Store PIN info in sessionStorage so we can check it when user returns
        sessionStorage.setItem("plexPin", JSON.stringify(pinData));
        // Redirect to Plex auth page
        window.location.href = authUrl;
        return;
      }

      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        "PlexAuth",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      );

      if (popup) {
        setPlexPopup(popup);

        // Check if popup was closed without completing auth
        const popupCheck = setInterval(() => {
          if (popup.closed) {
            clearInterval(popupCheck);
            // Only clear if we haven't received auth token
            if (plexPin) {
              setPlexLoading(false);
            }
          }
        }, 500);
      } else {
        // Popup was blocked - fall back to redirect
        sessionStorage.setItem("plexPin", JSON.stringify(pinData));
        window.location.href = authUrl;
      }
    } catch (error) {
      toast({
        title: "Plex Login Failed",
        description:
          error instanceof Error ? error.message : "Failed to start Plex login",
        variant: "destructive",
      });
      setPlexLoading(false);
    }
  };

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
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await login(formData.username, formData.password);

      toast({
        title: "Success",
        description: "Logged in successfully",
        variant: "success",
      });

      // AuthGuard handle it once state updates
    } catch (error) {
      toast({
        title: "Login Failed",
        description:
          error instanceof Error ? error.message : "Invalid credentials",
        variant: "destructive",
      });
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
            </div>

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
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
