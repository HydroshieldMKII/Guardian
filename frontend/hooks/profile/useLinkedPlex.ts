"use client";

import { useEffect, useState } from "react";
import { isAdminUser, useAuth } from "@/contexts/auth-context";
import { usePlexOAuth } from "@/hooks/use-plex-oauth";
import { useToast } from "@/hooks/use-toast";

export interface LinkedPlexAccount {
  plexUserId?: string;
  plexUsername?: string;
  plexThumb?: string;
}

const LINK_COPY = {
  success: {
    title: "Plex account linked",
    description: "You can now sign in with Plex",
  },
  failed: {
    title: "Plex link failed",
    description: "Could not link your Plex account",
  },
  expired: {
    title: "Plex link expired",
    description: "The Plex window timed out. Start again to retry.",
  },
  cancelled: {
    title: "Plex link cancelled",
    description: "The Plex window closed before the account was linked",
  },
};

const accountOf = (source: LinkedPlexAccount): LinkedPlexAccount => ({
  plexUserId: source.plexUserId,
  plexUsername: source.plexUsername,
  plexThumb: source.plexThumb,
});

export function useLinkedPlex(open: boolean) {
  const { user, linkPlexAccount, unlinkPlexAccount } = useAuth();
  const admin = user && isAdminUser(user) ? user : null;
  const { toast } = useToast();
  const [fresh, setFresh] = useState<LinkedPlexAccount | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  useEffect(() => {
    if (open && admin) {
      fetch("/api/pg/auth/me", { credentials: "include" })
        .then((res) =>
          res.ok ? (res.json() as Promise<LinkedPlexAccount>) : null,
        )
        .then((data) => {
          if (data) setFresh(accountOf(data));
        })
        .catch(() => undefined);
    }
    if (!open) {
      setFresh(null);
    }
  }, [open, admin]);

  const {
    loading: linking,
    waiting,
    start: link,
    cancel: cancelLink,
  } = usePlexOAuth({ onAuthenticated: linkPlexAccount, copy: LINK_COPY });

  useEffect(() => {
    if (!open) cancelLink();
  }, [open, cancelLink]);

  const unlink = async () => {
    setUnlinking(true);
    try {
      await unlinkPlexAccount();
      toast({
        title: "Plex account unlinked",
        description:
          "Signing in with Plex is no longer available for this account",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Unlink failed",
        description:
          error instanceof Error
            ? error.message
            : "Failed to unlink Plex account",
        variant: "destructive",
      });
    } finally {
      setUnlinking(false);
    }
  };

  const account = fresh?.plexUserId
    ? fresh
    : admin?.plexUserId
      ? accountOf(admin)
      : null;

  return { account, linking, waiting, link, cancelLink, unlinking, unlink };
}

export type LinkedPlex = ReturnType<typeof useLinkedPlex>;
