"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { EmptyState } from "@/components/ui/entity";
import { PageLoader } from "@/components/three-dot-loader";
import { NoteRequestDialogs } from "@/components/portal/NoteRequestDialogs";
import { PortalDeviceRow } from "@/components/portal/PortalDeviceRow";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalRules } from "@/components/portal/PortalRules";
import { canAddNote } from "@/lib/portal";
import type { PortalDevice, PortalSettings, PortalUserRules } from "@/types";

interface PortalRulesResponse {
  enabled?: boolean;
  rules?: PortalUserRules | null;
}

interface ErrorResponse {
  message?: string;
}

export default function UserPortalPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [devices, setDevices] = useState<PortalDevice[]>([]);
  const [userRules, setUserRules] = useState<PortalUserRules | null>(null);
  const [settings, setSettings] = useState<PortalSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [note, setNote] = useState<{
    device: PortalDevice;
    open: boolean;
    round: number;
  } | null>(null);
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
          const devicesData = (await devicesRes.json()) as PortalDevice[];
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

  const openNote = (device: PortalDevice) =>
    setNote((current) => ({
      device,
      open: true,
      round: (current?.round ?? 0) + 1,
    }));

  const closeNote = () =>
    setNote((current) => current && { ...current, open: false });

  const submitApprovalRequest = async (description: string) => {
    if (!note) return;

    setIsRequesting(true);
    try {
      const response = await fetch(
        `/api/pg/user-portal/devices/${note.device.id}/request`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ description }),
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

      closeNote();
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

  if (authLoading || isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-background">
      <PortalHeader
        refreshing={isRefreshing}
        onRefresh={() => void fetchData(true)}
      />

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
                  <PortalDeviceRow
                    key={device.id}
                    device={device}
                    canAddNote={canAddNote(device, settings)}
                    onAddNote={openNote}
                  />
                ))}
              </ul>
            )}
          </section>

          {userRules && <PortalRules rules={userRules} />}
        </div>
      </main>

      {note && (
        <NoteRequestDialogs
          key={note.round}
          device={note.device}
          open={note.open}
          submitting={isRequesting}
          onClose={closeNote}
          onSubmit={(description) => void submitApprovalRequest(description)}
        />
      )}
    </div>
  );
}
