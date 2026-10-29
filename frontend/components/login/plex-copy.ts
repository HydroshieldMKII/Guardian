import type { PlexOAuthCopy } from "@/hooks/use-plex-oauth";

export const LOGIN_PLEX_COPY: PlexOAuthCopy = {
  success: {
    title: "Signed in",
    description: "You are signed in with Plex",
  },
  failed: {
    title: "Plex sign-in failed",
    description: "Could not sign you in with Plex",
  },
  expired: {
    title: "Plex sign-in expired",
    description: "The sign-in window timed out. Start again to retry.",
  },
  cancelled: {
    title: "Plex sign-in cancelled",
    description: "The Plex window closed before you signed in",
  },
};
