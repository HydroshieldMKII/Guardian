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
import {
  Lock,
  Mail,
  User,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sun,
  Moon,
} from "lucide-react";
import { ThreeDotLoader } from "@/components/three-dot-loader";
import { ErrorHandler } from "@/components/error-handler";

export default function SetupPage() {
  const {
    createAdmin,
    isLoading,
    setupRequired,
    backendError,
    retryConnection,
  } = useAuth();
  const { toast } = useToast();
  const { theme, toggleTheme } = useTheme();

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const getPasswordRequirements = () => {
    const password = formData.password;
    return {
      length: password.length >= 12,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};:'",./<>?\\|~]/.test(password),
    };
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.username || formData.username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    }

    // Email is optional, but if provided must be valid
    const emailRegex = /^[a-zA-Z0-9._%-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!formData.password || formData.password.length < 12) {
      newErrors.password = "Password must be at least 12 characters";
    }

    // Password complexity check
    const requirements = getPasswordRequirements();
    if (
      !requirements.uppercase ||
      !requirements.lowercase ||
      !requirements.number ||
      !requirements.special
    ) {
      newErrors.password = "Password must match all complexity requirements";
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
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
      await createAdmin(
        formData.username,
        formData.email,
        formData.password,
        formData.confirmPassword,
      );

      toast({
        title: "Success",
        description: "Admin account created successfully",
        variant: "success",
      });

      // AuthGuard handle it once state updates
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to create admin account",
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

  // Don't render form if setup is not required
  if (!setupRequired) {
    return null;
  }

  const requirements = getPasswordRequirements();

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
            Create your admin account to get started
          </CardDescription>
        </CardHeader>

        <CardContent className="pb-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div className="space-y-2">
              <label
                htmlFor="username"
                className="text-sm font-semibold text-foreground"
              >
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="Choose a username"
                  value={formData.username}
                  onChange={handleChange}
                  disabled={isSubmitting}
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
            <div className="space-y-3">
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
                  placeholder="Minimum 12 characters"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={isSubmitting}
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

              {/* Password Requirements */}
              <div className="space-y-2 bg-muted/50 rounded-lg p-3">
                <p className="text-xs font-medium text-foreground">
                  Requirements:
                </p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    {requirements.length ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                    ) : (
                      <div className="h-3 w-3 rounded-full border border-muted-foreground" />
                    )}
                    <span
                      className={
                        requirements.length
                          ? "text-green-700"
                          : "text-muted-foreground"
                      }
                    >
                      At least 12 characters
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {requirements.uppercase ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                    ) : (
                      <div className="h-3 w-3 rounded-full border border-muted-foreground" />
                    )}
                    <span
                      className={
                        requirements.uppercase
                          ? "text-green-700"
                          : "text-muted-foreground"
                      }
                    >
                      Uppercase letter (A-Z)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {requirements.lowercase ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                    ) : (
                      <div className="h-3 w-3 rounded-full border border-muted-foreground" />
                    )}
                    <span
                      className={
                        requirements.lowercase
                          ? "text-green-700"
                          : "text-muted-foreground"
                      }
                    >
                      Lowercase letter (a-z)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {requirements.number ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                    ) : (
                      <div className="h-3 w-3 rounded-full border border-muted-foreground" />
                    )}
                    <span
                      className={
                        requirements.number
                          ? "text-green-700"
                          : "text-muted-foreground"
                      }
                    >
                      Number (0-9)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    {requirements.special ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                    ) : (
                      <div className="h-3 w-3 rounded-full border border-muted-foreground" />
                    )}
                    <span
                      className={
                        requirements.special
                          ? "text-green-700"
                          : "text-muted-foreground"
                      }
                    >
                      Special character (!, @, #, $, %, etc.)
                    </span>
                  </div>
                </div>
              </div>

              {errors.password && (
                <div className="flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle className="h-3 w-3" />
                  {errors.password}
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <label
                htmlFor="confirmPassword"
                className="text-sm font-semibold text-foreground"
              >
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  className={`pl-10 pr-10 ${errors.confirmPassword ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isSubmitting}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <div className="flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle className="h-3 w-3" />
                  {errors.confirmPassword}
                </div>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-semibold text-foreground"
              >
                Email{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (optional)
                </span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  className={`pl-10 ${errors.email ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                />
              </div>
              {errors.email && (
                <div className="flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle className="h-3 w-3" />
                  {errors.email}
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
              {isSubmitting ? "Creating Account..." : "Create Admin Account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
