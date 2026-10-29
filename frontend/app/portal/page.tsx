"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useAuth, isPlexUser, isAdminUser } from "@/contexts/auth-context";
import { useRouter } from "next/navigation";
import { useTheme } from "@/hooks/use-theme";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
  Chip,
  EmptyState,
  Field,
  Panel,
  PillRow,
  StatusPill,
  type Tone,
} from "@/components/ui/entity";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
} from "@/components/ui/modal";
import { HintTooltip } from "@/components/ui/hint-tooltip";
import { RefreshButton } from "@/components/ui/refresh-button";
import { BYPASSED_BY_TEMPORARY_ACCESS } from "@/lib/device-policies";
import { formatTimeLeft } from "@/lib/duration";
import { cn } from "@/lib/utils";
import {
  Sun,
  Moon,
  LogOut,
  Smartphone,
  Monitor,
  Tv,
  Tablet,
  Clock,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { PageLoader } from "@/components/three-dot-loader";

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

interface PortalRulesResponse {
  enabled?: boolean;
  rules?: UserPortalUserRules | null;
}

interface ErrorResponse {
  message?: string;
}

const NETWORK_POLICY_LABEL: Record<string, string> = {
  both: "Local network and internet",
  lan: "Local network only",
  wan: "Internet only",
};

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const TemporaryAccessBadge = ({ device }: { device: UserPortalDevice }) => {
  const timeLeft = formatTimeLeft(device.temporaryAccessUntil!);

  return (
    <HintTooltip
      hint={
        <div className="space-y-1">
          <p className="font-medium">Temporary access granted</p>
          <p className="text-sm">Time remaining: {timeLeft}</p>
          {device.temporaryAccessBypassPolicies && (
            <p className="text-sm">
              While it lasts, {BYPASSED_BY_TEMPORARY_ACCESS} do not apply to
              this device.
            </p>
          )}
        </div>
      }
      screenReaderHint={`Temporary access expires in ${timeLeft}`}
    >
      <StatusPill
        dot
        tone={device.temporaryAccessBypassPolicies ? "accent" : "info"}
        className="cursor-help"
      >
        Temporary access
      </StatusPill>
    </HintTooltip>
  );
};

const STATUS_BADGES: Record<
  UserPortalDevice["status"],
  { tone: Tone; label: string; hint: string }
> = {
  approved: {
    tone: "positive",
    label: "Approved",
    hint: "The server owner has approved this device. You can stream on it.",
  },
  rejected: {
    tone: "danger",
    label: "Rejected",
    hint: "The server owner has blocked this device. You cannot stream on it.",
  },
  pending: {
    tone: "warning",
    label: "Pending",
    hint: "The server owner has not reviewed this device yet.",
  },
};

const StatusBadge = ({
  type,
  device,
}: {
  type: UserPortalDevice["status"];
  device: UserPortalDevice;
}) => {
  const badge = STATUS_BADGES[type];
  const hint =
    type === "pending" && device.requestSubmittedAt
      ? `${badge.hint} Your note has been sent to them.`
      : badge.hint;

  return (
    <StatusPill dot tone={badge.tone} hint={hint}>
      {badge.label}
    </StatusPill>
  );
};

const ScheduleList = ({ rules }: { rules: UserPortalTimeRule[] }) => (
  <ul className="divide-y divide-border/70 rounded-lg border bg-background/40">
    {rules.map((rule) => (
      <li
        key={rule.id}
        className="flex items-center justify-between gap-3 px-3 py-2.5"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {DAY_NAMES[rule.dayOfWeek]}
            {rule.ruleName && (
              <span className="font-normal text-muted-foreground">
                {" "}
                ({rule.ruleName})
              </span>
            )}
          </p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {rule.startTime} – {rule.endTime}
          </p>
        </div>
        <StatusPill size="sm" tone={rule.enabled ? "danger" : "neutral"}>
          {rule.enabled ? "Blocking" : "Paused"}
        </StatusPill>
      </li>
    ))}
  </ul>
);

const RuleItem = ({
  title,
  description,
  value,
  children,
}: {
  title: string;
  description: string;
  value?: React.ReactNode;
  children?: React.ReactNode;
}) => (
  <div className="space-y-3 px-4 py-4 sm:px-5">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      {value && <div className="shrink-0">{value}</div>}
    </div>
    {children}
  </div>
);

const DeviceSummary = ({ device }: { device: UserPortalDevice | null }) => (
  <Panel className="flex items-center gap-3 p-3">
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
      {device && getDeviceIcon(device.devicePlatform)}
    </span>
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-foreground">
        {device?.deviceName}
      </p>
      <p className="truncate text-xs text-muted-foreground">
        {device?.deviceProduct} · {device?.devicePlatform}
      </p>
    </div>
  </Panel>
);

function getDeviceIcon(platform: string) {
  const p = platform.toLowerCase();
  if (p.includes("tv") || p.includes("roku") || p.includes("fire")) {
    return <Tv className="size-[18px]" />;
  }
  if (p.includes("ios") || p.includes("android") || p.includes("mobile")) {
    return <Smartphone className="size-[18px]" />;
  }
  if (p.includes("tablet") || p.includes("ipad")) {
    return <Tablet className="size-[18px]" />;
  }
  return <Monitor className="size-[18px]" />;
}

export default function UserPortalPage() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  const [devices, setDevices] = useState<UserPortalDevice[]>([]);
  const [userRules, setUserRules] = useState<UserPortalUserRules | null>(null);
  const [settings, setSettings] = useState<PortalSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<UserPortalDevice | null>(
    null,
  );
  const [requestDescription, setRequestDescription] = useState("");
  const [isRequesting, setIsRequesting] = useState(false);

  const fetchData = useCallback(
    async (showRefreshing = false) => {
      if (showRefreshing) {
        setIsRefreshing(true);
      }

      try {
        const devicesRes = await fetch("/api/pg/user-portal/devices", {
          credentials: "include",
        });
        if (devicesRes.ok) {
          const devicesData = (await devicesRes.json()) as UserPortalDevice[];
          setDevices(devicesData);
        }

        const settingsRes = await fetch("/api/pg/user-portal/settings", {
          credentials: "include",
        });
        if (settingsRes.ok) {
          const settingsData = (await settingsRes.json()) as PortalSettings;
          setSettings(settingsData);

          if (settingsData.showRules) {
            const rulesRes = await fetch("/api/pg/user-portal/rules", {
              credentials: "include",
            });
            if (rulesRes.ok) {
              const rulesData = (await rulesRes.json()) as PortalRulesResponse;
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
    },
    [toast],
  );

  useEffect(() => {
    if (!authLoading && user) {
      void fetchData();
    }
  }, [authLoading, user, fetchData]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch {
      toast({
        title: "Error",
        description: "Failed to sign out",
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
        },
      );

      if (!response.ok) {
        const error = (await response.json()) as ErrorResponse;
        throw new Error(error.message || "Failed to submit request");
      }

      toast({
        title: "Note submitted",
        description: "The server owner will see your note next to this device",
        variant: "success",
      });

      setConfirmModalOpen(false);
      setRequestModalOpen(false);
      setSelectedDevice(null);
      setRequestDescription("");
      void fetchData();
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

  const canAddNote = (device: UserPortalDevice) =>
    !device.requestSubmittedAt &&
    (device.status === "pending" ||
      (device.status === "rejected" &&
        Boolean(settings?.allowRejectedRequests)));

  const showsNote = (device: UserPortalDevice) =>
    Boolean(device.requestSubmittedAt && device.requestDescription) &&
    (device.status === "pending" || device.status === "rejected");

  if (authLoading || isLoading) {
    return <PageLoader />;
  }

  const avatar = getUserAvatar();
  const displayName = getUserDisplayName();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 h-14 w-full border-b border-border/70 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:h-16">
        <div className="mx-auto flex h-full w-full max-w-3xl items-center gap-2 px-4 sm:px-6">
          <span className="-ml-2 flex shrink-0 items-center">
            <Image
              src="/logo_dark.svg"
              alt="Guardian"
              width={1024}
              height={768}
              className="block h-[52px] w-auto dark:hidden sm:h-[60px]"
              priority
            />
            <Image
              src="/logo_white.svg"
              alt="Guardian"
              width={1024}
              height={768}
              className="hidden h-[52px] w-auto dark:block sm:h-[60px]"
              priority
            />
          </span>

          <div className="ml-auto flex items-center gap-1">
            <RefreshButton
              variant="ghost"
              refreshing={isRefreshing}
              onRefresh={() => void fetchData(true)}
              className="size-9 text-muted-foreground hover:text-foreground"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="size-9 text-muted-foreground hover:text-foreground"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? (
                <Sun className="size-4" />
              ) : (
                <Moon className="size-4" />
              )}
            </Button>
            <span aria-hidden className="mx-1.5 h-5 w-px bg-border" />
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar className="size-8 shrink-0">
                {avatar && <AvatarImage src={avatar} alt={displayName} />}
                <AvatarFallback className="bg-muted text-xs font-semibold text-foreground">
                  {displayName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[160px] truncate text-sm font-medium text-foreground sm:block">
                {displayName}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleLogout()}
              className="ml-1 text-muted-foreground hover:text-foreground"
              title="Logout"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl animate-in fade-in px-4 py-8 duration-300 motion-reduce:animate-none sm:px-6 sm:py-10">
        <div className="space-y-10">
          <section className="space-y-4">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                My devices
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Devices registered to your Plex account on this server
              </p>
            </div>

            {devices.length === 0 ? (
              <EmptyState
                className="rounded-2xl py-14"
                title="No devices yet"
                description="Your devices appear here the first time you stream on them"
              />
            ) : (
              <ul className="divide-y divide-border/70 rounded-2xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.03)]">
                {devices.map((device) => (
                  <li key={device.id} className="px-4 py-4 sm:px-5">
                    <div className="flex items-start gap-3 sm:gap-4">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                        {getDeviceIcon(device.devicePlatform)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                          <p className="truncate text-sm font-medium text-foreground sm:text-base">
                            {device.deviceName}
                          </p>
                          {getStatusBadge(device)}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">
                          {device.deviceProduct} · {device.devicePlatform}
                        </p>
                      </div>
                      {canAddNote(device) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRequestApproval(device)}
                          className="shrink-0"
                        >
                          <MessageSquare />
                          Add note
                        </Button>
                      )}
                    </div>

                    {showsNote(device) && (
                      <div
                        className={cn(
                          "mt-3 rounded-lg px-3 py-2.5 sm:ml-14",
                          device.requestNoteReadAt
                            ? "bg-allowed/8"
                            : "bg-muted/70",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <MessageSquare className="size-3.5" />
                            Your note to the server owner
                          </p>
                          <StatusPill
                            size="sm"
                            tone={
                              device.requestNoteReadAt ? "positive" : "neutral"
                            }
                          >
                            {device.requestNoteReadAt ? "Read" : "Not read yet"}
                          </StatusPill>
                        </div>
                        <p className="mt-1.5 whitespace-pre-wrap break-words text-sm text-foreground">
                          {device.requestDescription}
                        </p>
                        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span>
                            Submitted{" "}
                            {new Date(
                              device.requestSubmittedAt!,
                            ).toLocaleString()}
                          </span>
                          {device.requestNoteReadAt && (
                            <span className="text-allowed">
                              Read on{" "}
                              {new Date(
                                device.requestNoteReadAt,
                              ).toLocaleString()}
                            </span>
                          )}
                        </p>
                      </div>
                    )}

                    {device.rules && device.rules.timeRules.length > 0 && (
                      <div className="mt-3 space-y-2 sm:ml-14">
                        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <Clock className="size-3.5" />
                          Schedule for this device
                        </p>
                        <ScheduleList rules={device.rules.timeRules} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {userRules && (
            <section className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                  Your rules
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  What the server owner allows on your account
                </p>
              </div>

              <div className="divide-y divide-border/70 rounded-2xl border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.03)]">
                <RuleItem
                  title="Networks"
                  description="Where you are allowed to stream from"
                  value={
                    <StatusPill>
                      {NETWORK_POLICY_LABEL[userRules.networkPolicy] ??
                        NETWORK_POLICY_LABEL.both}
                    </StatusPill>
                  }
                />
                <RuleItem
                  title="IP addresses"
                  description={
                    userRules.ipAccessPolicy === "restricted" &&
                    userRules.allowedIPs &&
                    userRules.allowedIPs.length > 0
                      ? "You can only stream from these addresses"
                      : "Which addresses you can stream from"
                  }
                  value={
                    <StatusPill>
                      {userRules.ipAccessPolicy === "all"
                        ? "Any address"
                        : "Only listed addresses"}
                    </StatusPill>
                  }
                >
                  {userRules.ipAccessPolicy === "restricted" &&
                    userRules.allowedIPs &&
                    userRules.allowedIPs.length > 0 && (
                      <PillRow>
                        {userRules.allowedIPs.map((ip) => (
                          <Chip key={ip}>{ip}</Chip>
                        ))}
                      </PillRow>
                    )}
                </RuleItem>
                <RuleItem
                  title="New devices"
                  description="How new devices are handled when they first connect"
                  value={
                    <StatusPill
                      dot
                      tone={
                        userRules.effectiveDefaultBlock ? "danger" : "positive"
                      }
                    >
                      {userRules.effectiveDefaultBlock
                        ? "Blocked until approved"
                        : "Allowed straight away"}
                    </StatusPill>
                  }
                />
                <RuleItem
                  title="Streams at once"
                  description="How many devices can stream at the same time"
                  value={
                    <StatusPill>
                      {userRules.effectiveConcurrentStreamLimit === 0
                        ? "Unlimited"
                        : `${userRules.effectiveConcurrentStreamLimit} stream${userRules.effectiveConcurrentStreamLimit > 1 ? "s" : ""}`}
                    </StatusPill>
                  }
                />
                {userRules.timeRules.length > 0 && (
                  <RuleItem
                    title="Schedule"
                    description="The hours you cannot stream, on any of your devices"
                  >
                    <ScheduleList rules={userRules.timeRules} />
                  </RuleItem>
                )}
              </div>
            </section>
          )}
        </div>
      </main>

      <Modal open={requestModalOpen} onOpenChange={setRequestModalOpen}>
        <ModalHeader
          title="Send a note to the server owner"
          description="Tell the server owner why you need access on this device. They see your note next to the device when they review it."
        />
        <ModalBody>
          <DeviceSummary device={selectedDevice} />
          <Field
            label="Note"
            htmlFor="request-note"
            action={<StatusPill tone="neutral">Optional</StatusPill>}
          >
            <Textarea
              id="request-note"
              placeholder="This is my living room TV"
              value={requestDescription}
              onChange={(e) => setRequestDescription(e.target.value)}
              maxLength={500}
              rows={4}
            />
            <p className="text-right text-xs tabular-nums text-muted-foreground">
              {requestDescription.length}/500
            </p>
          </Field>
        </ModalBody>
        <ModalFooter>
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
        </ModalFooter>
      </Modal>

      <Modal open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <ModalHeader
          title="Confirm submission"
          description="You can only submit a note once per device. After submission, you will not be able to modify or add another note for this device."
        />
        <ModalBody>
          <DeviceSummary device={selectedDevice} />
          {requestDescription ? (
            <div className="rounded-lg bg-muted/70 px-3 py-2.5">
              <p className="text-xs font-medium text-muted-foreground">
                Your note
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
                {requestDescription}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No note provided. You can go back to add one.
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="outline"
            onClick={() => {
              setConfirmModalOpen(false);
              setRequestModalOpen(true);
            }}
            disabled={isRequesting}
          >
            Go back
          </Button>
          <Button
            onClick={() => void submitApprovalRequest()}
            disabled={isRequesting}
          >
            {isRequesting ? (
              <>
                <Loader2 className="animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit note"
            )}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
}
