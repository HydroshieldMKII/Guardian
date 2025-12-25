"use client";

import React, { useState, useEffect } from "react";
import { useAuth, isPlexUser, isAdminUser } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useTheme } from "@/hooks/use-theme";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sun,
  Moon,
  LogOut,
  Smartphone,
  Monitor,
  Tv,
  Tablet,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  MessageSquare,
  Globe,
  Wifi,
  Shield,
  HelpCircle,
  Users,
} from "lucide-react";
import { ThreeDotLoader } from "@/components/three-dot-loader";

interface UserPortalTimeRule {
  id: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  ruleName: string;
  enabled: boolean;
  deviceIdentifier?: string;
}

interface UserPortalDeviceRules {
  timeRules: UserPortalTimeRule[];
}

interface UserPortalDevice {
  id: number;
  deviceIdentifier: string;
  deviceName: string;
  devicePlatform: string;
  deviceProduct: string;
  status: "pending" | "approved" | "rejected";
  firstSeen: string;
  lastSeen: string;
  requestDescription?: string;
  requestSubmittedAt?: string;
  requestNoteReadAt?: string;
  hasTemporaryAccess: boolean;
  temporaryAccessUntil?: string;
  temporaryAccessBypassPolicies?: boolean;
  excludeFromConcurrentLimit: boolean;
  rules?: UserPortalDeviceRules;
}

interface UserPortalUserRules {
  networkPolicy: "both" | "lan" | "wan";
  ipAccessPolicy: "all" | "restricted";
  allowedIPs?: string[];
  concurrentStreamLimit: number | null;
  effectiveConcurrentStreamLimit: number;
  defaultBlock: boolean | null;
  effectiveDefaultBlock: boolean;
  timeRules: UserPortalTimeRule[];
}

interface PortalSettings {
  showRules: boolean;
  allowRejectedRequests: boolean;
}

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// Helper function to calculate time left
const getTemporaryAccessTimeLeft = (until: string) => {
  const now = new Date();
  const endTime = new Date(until);
  const diffMs = endTime.getTime() - now.getTime();

  if (diffMs <= 0) return "Expired";

  const diffMins = Math.floor(diffMs / 60000);
  const totalHours = Math.floor(diffMins / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const mins = diffMins % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);

  return parts.join(" ");
};

// Temporary Access Badge component with controlled tooltip for mobile support
const TemporaryAccessBadge = ({ device }: { device: UserPortalDevice }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile on mount
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Handle open change - only allow Radix to control on desktop
  const handleOpenChange = (open: boolean) => {
    if (!isMobile) {
      setIsOpen(open);
    }
  };

  const timeLeft = getTemporaryAccessTimeLeft(device.temporaryAccessUntil!);

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={isOpen} onOpenChange={handleOpenChange}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex focus:outline-none rounded-md"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isMobile) {
                setIsOpen((prev) => !prev);
              }
            }}
            onMouseEnter={() => {
              if (!isMobile) setIsOpen(true);
            }}
            onMouseLeave={() => {
              if (!isMobile) setIsOpen(false);
            }}
          >
            <Badge
              variant="outline"
              className={`cursor-help ${
                device.temporaryAccessBypassPolicies
                  ? "text-purple-500 border-purple-500"
                  : "text-blue-500 border-blue-500"
              }`}
            >
              <Clock className="mr-1 h-3 w-3" />
              Temporary Access
              <HelpCircle className="ml-1 h-3 w-3 opacity-60" />
            </Badge>
          </button>
        </TooltipTrigger>
        <TooltipContent
          className="max-w-xs"
          onPointerDownOutside={(e) => {
            e.preventDefault();
            setIsOpen(false);
          }}
        >
          <div className="space-y-1">
            <p className="font-medium">Temporary access granted</p>
            <p className="text-sm">Time remaining: {timeLeft}</p>
            {device.temporaryAccessBypassPolicies && (
              <p className="text-sm text-purple-400">
                ✓ Bypasses all account rules
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Status Badge component with controlled tooltip for mobile support
const StatusBadge = ({
  type,
  device,
}: {
  type: "approved" | "rejected" | "pending";
  device: UserPortalDevice;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile on mount
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Handle open change - only allow Radix to control on desktop
  const handleOpenChange = (open: boolean) => {
    if (!isMobile) {
      setIsOpen(open);
    }
  };

  const badgeConfig = {
    approved: {
      className: "text-green-500 border-green-500",
      icon: <CheckCircle className="mr-1 h-3 w-3" />,
      label: "Approved",
      tooltip: "This device has been approved by the administrator",
    },
    rejected: {
      className: "text-red-500 border-red-500",
      icon: <XCircle className="mr-1 h-3 w-3" />,
      label: "Rejected",
      tooltip: "This device has been rejected by the administrator.",
    },
    pending: {
      className: "text-yellow-500 border-yellow-500",
      icon: <AlertCircle className="mr-1 h-3 w-3" />,
      label: "Pending",
      tooltip: `This device has not been reviewed by the administrator yet${device.requestSubmittedAt ? ". Your note has been submitted." : ""}`,
    },
  };

  const config = badgeConfig[type];

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={isOpen} onOpenChange={handleOpenChange}>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex focus:outline-none rounded-md"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isMobile) {
                setIsOpen((prev) => !prev);
              }
            }}
            onMouseEnter={() => {
              if (!isMobile) setIsOpen(true);
            }}
            onMouseLeave={() => {
              if (!isMobile) setIsOpen(false);
            }}
          >
            <Badge
              variant="outline"
              className={`cursor-help ${config.className}`}
            >
              {config.icon}
              {config.label}
            </Badge>
          </button>
        </TooltipTrigger>
        <TooltipContent
          className="max-w-xs"
          onPointerDownOutside={(e) => {
            e.preventDefault();
            setIsOpen(false);
          }}
        >
          <p>{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default function UserPortalPage() {
  const { user, userType, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  const [devices, setDevices] = useState<UserPortalDevice[]>([]);
  const [userRules, setUserRules] = useState<UserPortalUserRules | null>(null);
  const [settings, setSettings] = useState<PortalSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Request approval modal state
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<UserPortalDevice | null>(
    null
  );
  const [requestDescription, setRequestDescription] = useState("");
  const [isRequesting, setIsRequesting] = useState(false);

  // Fetch user data
  const fetchData = async (showRefreshing = false) => {
    if (showRefreshing) {
      setIsRefreshing(true);
    }

    try {
      // Fetch devices (includes device-specific rules if enabled)
      const devicesRes = await fetch("/api/pg/user-portal/devices", {
        credentials: "include",
      });
      if (devicesRes.ok) {
        const devicesData = await devicesRes.json();
        setDevices(devicesData);
      }

      // Fetch settings
      const settingsRes = await fetch("/api/pg/user-portal/settings", {
        credentials: "include",
      });
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setSettings(settingsData);

        // Fetch user rules if showRules is enabled
        if (settingsData.showRules) {
          const rulesRes = await fetch("/api/pg/user-portal/rules", {
            credentials: "include",
          });
          if (rulesRes.ok) {
            const rulesData = await rulesRes.json();
            if (rulesData.enabled && rulesData.rules) {
              setUserRules(rulesData.rules);
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch portal data:", error);
      toast({
        title: "Error",
        description: "Failed to load your data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    }
  }, [authLoading, user]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to logout",
        variant: "destructive",
      });
    }
  };

  const handleRequestApproval = (device: UserPortalDevice) => {
    setSelectedDevice(device);
    setRequestDescription(device.requestDescription || "");
    setRequestModalOpen(true);
  };

  const submitApprovalRequest = async () => {
    if (!selectedDevice) return;

    setIsRequesting(true);
    try {
      const response = await fetch(
        `/api/pg/user-portal/devices/${selectedDevice.id}/request`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ description: requestDescription }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to submit request");
      }

      toast({
        title: "Note Submitted",
        description: "Your note has been sent to the administrator",
        variant: "success",
      });

      setConfirmModalOpen(false);
      setRequestModalOpen(false);
      setSelectedDevice(null);
      setRequestDescription("");
      // Refresh devices
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to submit note",
        variant: "destructive",
      });
    } finally {
      setIsRequesting(false);
    }
  };

  const getDeviceIcon = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes("tv") || p.includes("roku") || p.includes("fire")) {
      return <Tv className="h-5 w-5" />;
    }
    if (p.includes("ios") || p.includes("android") || p.includes("mobile")) {
      return <Smartphone className="h-5 w-5" />;
    }
    if (p.includes("tablet") || p.includes("ipad")) {
      return <Tablet className="h-5 w-5" />;
    }
    return <Monitor className="h-5 w-5" />;
  };

  const getStatusBadge = (device: UserPortalDevice) => {
    if (device.hasTemporaryAccess && device.temporaryAccessUntil) {
      return <TemporaryAccessBadge device={device} />;
    }

    switch (device.status) {
      case "approved":
        return <StatusBadge type="approved" device={device} />;
      case "rejected":
        return <StatusBadge type="rejected" device={device} />;
      default:
        return <StatusBadge type="pending" device={device} />;
    }
  };

  const getUserDisplayName = () => {
    if (!user) return "User";
    if (isPlexUser(user)) {
      return user.plexUsername;
    }
    if (isAdminUser(user)) {
      return user.username;
    }
    return "User";
  };

  const getUserAvatar = () => {
    if (!user) return null;
    if (isPlexUser(user)) {
      return user.plexThumb;
    }
    if (isAdminUser(user)) {
      return user.avatarUrl || user.plexThumb;
    }
    return null;
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ThreeDotLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <Avatar className="h-10 w-10 ring-2 ring-primary/10 flex-shrink-0">
              {getUserAvatar() && (
                <AvatarImage
                  src={getUserAvatar()!}
                  alt={getUserDisplayName()}
                />
              )}
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {getUserDisplayName().charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-lg truncate max-w-[120px] sm:max-w-[200px]">
                {getUserDisplayName()}
              </span>
              <span className="text-xs text-muted-foreground">Plex User</span>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="h-9 w-9"
              title="Refresh"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-9 w-9"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="ml-2"
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="px-4 sm:px-6 lg:px-8 py-8 max-w-4xl mx-auto">
        <div className="space-y-8">
          {/* Devices Section */}
          <section>
            <div className="mb-4">
              <h2 className="text-2xl font-bold tracking-tight">My Devices</h2>
              <p className="text-muted-foreground mt-1">
                Devices registered to your Plex account on this server
              </p>
            </div>

            {devices.length === 0 ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center">
                    <Monitor className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No devices found</p>
                    <p className="text-sm text-muted-foreground/70 mt-1">
                      Your devices will appear here once you start streaming
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <TooltipProvider delayDuration={0}>
                <div className="grid gap-4">
                  {devices.map((device) => (
                    <Card key={device.id} className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="p-4 sm:p-5">
                          {/* Mobile: Stack vertically, Desktop: Row layout */}
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                                {getDeviceIcon(device.devicePlatform)}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold truncate text-sm sm:text-base">
                                  {device.deviceName}
                                </p>
                                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                                  {device.deviceProduct} •{" "}
                                  {device.devicePlatform}
                                </p>
                              </div>
                            </div>

                            {/* Desktop: Badge row on the right */}
                            <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                              {getStatusBadge(device)}

                              {/* Show request button only if note not already submitted */}
                              {!device.requestSubmittedAt &&
                                device.status === "pending" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleRequestApproval(device)
                                    }
                                    className="text-sm"
                                  >
                                    Add Note
                                  </Button>
                                )}
                              {!device.requestSubmittedAt &&
                                device.status === "rejected" &&
                                settings?.allowRejectedRequests && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleRequestApproval(device)
                                    }
                                    className="text-sm"
                                  >
                                    Add Note
                                  </Button>
                                )}
                            </div>
                          </div>

                          {/* Mobile: Badge row fully aligned to left edge */}
                          <div className="flex items-center gap-2 mt-3 sm:hidden">
                            {getStatusBadge(device)}

                            {/* Show request button only if note not already submitted */}
                            {!device.requestSubmittedAt &&
                              device.status === "pending" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRequestApproval(device)}
                                  className="text-xs"
                                >
                                  Add Note
                                </Button>
                              )}
                            {!device.requestSubmittedAt &&
                              device.status === "rejected" &&
                              settings?.allowRejectedRequests && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRequestApproval(device)}
                                  className="text-xs"
                                >
                                  Add Note
                                </Button>
                              )}
                          </div>
                        </div>

                        {/* Show submitted note for pending/rejected devices */}
                        {device.requestSubmittedAt &&
                          device.requestDescription &&
                          (device.status === "pending" ||
                            device.status === "rejected") && (
                            <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0">
                              <div
                                className={`rounded-lg p-3 sm:p-4 border ${device.requestNoteReadAt ? "bg-green-500/5 border-green-500/20" : "bg-muted/50 border-border/50"}`}
                              >
                                {/* Header row with label and badge */}
                                <div className="flex items-center justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2">
                                    <MessageSquare
                                      className={`h-4 w-4 flex-shrink-0 ${device.requestNoteReadAt ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}
                                    />
                                    <span className="text-xs font-medium text-muted-foreground">
                                      Your note to admin
                                    </span>
                                  </div>
                                  {device.requestNoteReadAt ? (
                                    <Badge
                                      variant="outline"
                                      className="text-xs border-green-600 dark:border-green-700 text-green-700 dark:text-green-400"
                                    >
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Read
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="text-xs border-amber-500 dark:border-amber-600 text-amber-600 dark:text-amber-400"
                                    >
                                      <Clock className="h-3 w-3 mr-1" />
                                      Pending Review
                                    </Badge>
                                  )}
                                </div>

                                {/* Note content */}
                                <div className="bg-background/50 rounded-md p-3 mb-2">
                                  <p className="text-sm break-words whitespace-pre-wrap">
                                    {device.requestDescription}
                                  </p>
                                </div>

                                {/* Footer with timestamp */}
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs text-muted-foreground">
                                  <span>
                                    Submitted{" "}
                                    {new Date(
                                      device.requestSubmittedAt
                                    ).toLocaleString()}
                                  </span>
                                  {device.requestNoteReadAt && (
                                    <span className="text-green-600 dark:text-green-400">
                                      Read on{" "}
                                      {new Date(
                                        device.requestNoteReadAt
                                      ).toLocaleString()}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                        {/* Show device-specific rules if available */}
                        {device.rules && device.rules.timeRules.length > 0 && (
                          <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0">
                            <div className="bg-blue-500/5 rounded-lg p-3 border border-blue-500/20">
                              <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Device Time Rules
                              </p>
                              <div className="space-y-1">
                                {device.rules.timeRules.map((rule) => (
                                  <div
                                    key={rule.id}
                                    className="flex items-center justify-between text-sm"
                                  >
                                    <span className="text-muted-foreground">
                                      {DAY_NAMES[rule.dayOfWeek]}:{" "}
                                      {rule.startTime} - {rule.endTime}
                                      {rule.ruleName && (
                                        <span className="ml-1 italic">
                                          ({rule.ruleName})
                                        </span>
                                      )}
                                    </span>
                                    <Badge
                                      variant={
                                        rule.enabled ? "outline" : "secondary"
                                      }
                                      className="text-xs"
                                    >
                                      {rule.enabled ? "Active" : "Inactive"}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TooltipProvider>
            )}
          </section>

          {/* User Rules Section (if enabled) */}
          {userRules && (
            <section>
              <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight">
                  Your Rules
                </h2>
                <p className="text-muted-foreground mt-1">
                  Access rules set by the server administrator for your account
                </p>
              </div>

              <div className="space-y-4">
                {/* Network & Access Policy */}
                <Card>
                  <CardHeader className="mt-2 pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Globe className="h-5 w-5 text-primary" />
                      Network Access
                    </CardTitle>
                    <CardDescription>
                      Controls where you can stream from
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Wifi className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Network Policy</span>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {userRules.networkPolicy === "both"
                          ? "LAN & WAN"
                          : userRules.networkPolicy.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">IP Access</span>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {userRules.ipAccessPolicy === "all"
                          ? "All IPs Allowed"
                          : "Restricted IPs"}
                      </Badge>
                    </div>
                    {userRules.ipAccessPolicy === "restricted" &&
                      userRules.allowedIPs &&
                      userRules.allowedIPs.length > 0 && (
                        <div className="pt-2 border-t mb-2">
                          <p className="text-xs text-muted-foreground mb-1">
                            Allowed IP addresses:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {userRules.allowedIPs.map((ip, idx) => (
                              <Badge
                                key={idx}
                                variant="secondary"
                                className="text-xs font-mono"
                              >
                                {ip}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                  </CardContent>
                </Card>

                {/* New Device Policy */}
                <Card>
                  <CardHeader className="mt-2 pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Smartphone className="h-5 w-5 text-primary" />
                      New Device Policy
                    </CardTitle>
                    <CardDescription>
                      How new devices are handled when they first connect
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">
                        Default action for new devices
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          userRules.effectiveDefaultBlock
                            ? "text-red-500 border-red-500"
                            : "text-green-500 border-green-500"
                        }
                      >
                        {userRules.effectiveDefaultBlock
                          ? "Block until approved"
                          : "Allowed by default"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Concurrent Stream Limit */}
                <Card>
                  <CardHeader className="mt-2 pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Concurrent Streams
                    </CardTitle>
                    <CardDescription>
                      How many devices can stream at the same time
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">
                        Maximum simultaneous streams
                      </span>
                      <Badge variant="outline">
                        {userRules.effectiveConcurrentStreamLimit === 0
                          ? "Unlimited"
                          : `${userRules.effectiveConcurrentStreamLimit} stream${userRules.effectiveConcurrentStreamLimit > 1 ? "s" : ""}`}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* User-wide Time Rules */}
                {userRules.timeRules.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3 mt-2">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Clock className="h-5 w-5 text-primary" />
                        Viewing Schedule
                      </CardTitle>
                      <CardDescription>
                        Time restrictions that apply to all your devices
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 mb-2">
                        {userRules.timeRules.map((rule) => (
                          <div
                            key={rule.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                                  rule.enabled
                                    ? "bg-red-500/10 text-red-500"
                                    : "bg-muted text-muted-foreground"
                                }`}
                              >
                                <Clock className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">
                                  {DAY_NAMES[rule.dayOfWeek]}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {rule.startTime} - {rule.endTime}
                                </p>
                              </div>
                            </div>
                            <Badge
                              variant={rule.enabled ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {rule.enabled ? "Blocking" : "Inactive"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </section>
          )}
        </div>
      </main>

      {/* Request Approval Modal */}
      <Dialog open={requestModalOpen} onOpenChange={setRequestModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note for Administrator</DialogTitle>
            <DialogDescription>
              Add a note for the server administrator explaining why you need
              access to this device.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{selectedDevice?.deviceName}</p>
              <p className="text-sm text-muted-foreground">
                {selectedDevice?.deviceProduct} •{" "}
                {selectedDevice?.devicePlatform}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Note (optional)</label>
              <Textarea
                placeholder="e.g., This is my living room TV..."
                value={requestDescription}
                onChange={(e) => setRequestDescription(e.target.value)}
                maxLength={500}
                rows={3}
              />
              <p className="text-xs text-muted-foreground text-right">
                {requestDescription.length}/500
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRequestModalOpen(false)}
              disabled={isRequesting}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setRequestModalOpen(false);
                setConfirmModalOpen(true);
              }}
            >
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Confirm Submission
            </DialogTitle>
            <DialogDescription className="pt-2">
              <strong className="text-foreground">Important:</strong> You can
              only submit a note{" "}
              <strong className="text-foreground">once per device</strong>.
              After submission, you will not be able to modify or add another
              note for this device.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-medium">{selectedDevice?.deviceName}</p>
              <p className="text-sm text-muted-foreground">
                {selectedDevice?.deviceProduct} •{" "}
                {selectedDevice?.devicePlatform}
              </p>
            </div>

            {requestDescription && (
              <div className="p-3 bg-muted/50 rounded-lg border">
                <p className="text-xs text-muted-foreground mb-1">Your note:</p>
                <p className="text-sm">{requestDescription}</p>
              </div>
            )}

            {!requestDescription && (
              <p className="text-sm text-muted-foreground italic">
                No note provided. You can go back to add one.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setConfirmModalOpen(false);
                setRequestModalOpen(true);
              }}
              disabled={isRequesting}
            >
              Go Back
            </Button>
            <Button
              onClick={submitApprovalRequest}
              disabled={isRequesting}
              variant="default"
            >
              {isRequesting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit Note"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
