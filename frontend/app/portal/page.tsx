"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/hooks/use-toast";
import { usePortalData, useSendPortalNote } from "@/hooks/usePortal";
import { EmptyState } from "@/components/ui/entity";
import { PageLoader } from "@/components/three-dot-loader";
import { NoteRequestDialogs } from "@/components/portal/NoteRequestDialogs";
import { PortalDeviceRow } from "@/components/portal/PortalDeviceRow";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalRules } from "@/components/portal/PortalRules";
import { canAddNote } from "@/lib/portal";
import type { PortalDevice } from "@/types";

export default function UserPortalPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { devices, settings, userRules, loading, refreshing, refresh } =
    usePortalData(!authLoading && Boolean(user));
  const sendNote = useSendPortalNote();

  const [note, setNote] = useState<{
    device: PortalDevice;
    open: boolean;
    round: number;
  } | null>(null);

  const openNote = (device: PortalDevice) =>
    setNote((current) => ({
      device,
      open: true,
      round: (current?.round ?? 0) + 1,
    }));

  const closeNote = () =>
    setNote((current) => current && { ...current, open: false });

  const submitNote = (device: PortalDevice, description: string) =>
    sendNote.mutate(
      { deviceId: device.id, description },
      {
        onSuccess: () => {
          toast({
            title: "Note submitted",
            description:
              "The server owner will see your note next to this device",
            variant: "success",
          });
          closeNote();
        },
        onError: (error) => {
          toast({
            title: "Error",
            description: error.message,
            variant: "destructive",
          });
        },
      },
    );

  if (authLoading || loading) {
    return <PageLoader />;
  }

  return (
    <div className="min-h-screen bg-background">
      <PortalHeader refreshing={refreshing} onRefresh={() => void refresh()} />

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
          submitting={sendNote.isPending}
          onClose={closeNote}
          onSubmit={(description) => submitNote(note.device, description)}
        />
      )}
    </div>
  );
}
