"use client";

import { useState } from "react";
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
import { Lock, User, Eye, EyeOff, AlertCircle, Sun, Moon } from "lucide-react";
import { ThreeDotLoader } from "@/components/three-dot-loader";
import { ErrorHandler } from "@/components/error-handler";

export default function LoginPage() {
  const { login, isLoading, isAuthenticated, backendError, retryConnection } =
    useAuth();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();

  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);

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
              disabled={isSubmitting}
              className="w-full mt-2"
              size="lg"
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
