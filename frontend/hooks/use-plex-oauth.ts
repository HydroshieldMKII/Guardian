"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";

const PLEX_AUTH_URL = "https://app.plex.tv/auth";
const PIN_CHECK_INTERVAL_MS = 2000;
const POPUP_CHECK_INTERVAL_MS = 500;
const STORAGE_KEY = "plexPin";
const POPUP_WIDTH = 600;
const POPUP_HEIGHT = 700;

export interface PlexPin {
  id: number;
  code: string;
  clientId: string;
  expiresAt: string;
}

interface ToastCopy {
  title: string;
  description: string;
}

export interface PlexOAuthCopy {
  success: ToastCopy;
  failed: ToastCopy;
  expired: ToastCopy;
  cancelled: ToastCopy;
}

interface UsePlexOAuthOptions {
  copy: PlexOAuthCopy;
  onAuthenticated: (authToken: string) => Promise<void>;
  redirectWhenPopupIsUnavailable?: boolean;
}

const describe = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

const authUrl = (pin: PlexPin, forwardUrl?: string) => {
  const url = `${PLEX_AUTH_URL}#?clientID=${encodeURIComponent(pin.clientId)}&code=${encodeURIComponent(pin.code)}&context%5Bdevice%5D%5Bproduct%5D=Guardian`;
  return forwardUrl
    ? `${url}&forwardUrl=${encodeURIComponent(forwardUrl)}`
    : url;
};

const readStoredPin = (): PlexPin | null => {
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  sessionStorage.removeItem(STORAGE_KEY);

  try {
    const pin = JSON.parse(stored) as PlexPin;
    return new Date(pin.expiresAt) > new Date() ? pin : null;
  } catch {
    return null;
  }
};

export const usePlexOAuth = ({
  copy,
  onAuthenticated,
  redirectWhenPopupIsUnavailable = false,
}: UsePlexOAuthOptions) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [pin, setPin] = useState<PlexPin | null>(null);

  const popupRef = useRef<Window | null>(null);
  const pinRef = useRef<PlexPin | null>(null);
  const copyRef = useRef(copy);
  const onAuthenticatedRef = useRef(onAuthenticated);

  copyRef.current = copy;
  onAuthenticatedRef.current = onAuthenticated;

  const closePopup = useCallback(() => {
    const popup = popupRef.current;
    popupRef.current = null;
    if (popup && !popup.closed) {
      popup.close();
    }
  }, []);

  const stop = useCallback(() => {
    closePopup();
    pinRef.current = null;
    setPin(null);
    setLoading(false);
  }, [closePopup]);

  const cancel = useCallback(() => {
    const abandoned = pinRef.current;
    if (!abandoned) return;

    stop();

    void fetch(`/api/pg/auth/plex/pin/${abandoned.clientId}`, {
      method: "DELETE",
    }).catch(() => undefined);

    toast({ ...copyRef.current.cancelled });
  }, [stop, toast]);

  useEffect(() => {
    if (!pin) return;

    let settled = false;

    const check = async () => {
      try {
        const response = await fetch(`/api/pg/auth/plex/pin/${pin.clientId}`);
        if (!response.ok) return;

        const data = (await response.json()) as { authToken?: string };
        if (!data.authToken || settled) return;

        settled = true;
        closePopup();
        pinRef.current = null;
        setPin(null);
        setLoading(true);

        try {
          await onAuthenticatedRef.current(data.authToken);
          toast({ ...copyRef.current.success, variant: "success" });
        } catch (error) {
          toast({
            title: copyRef.current.failed.title,
            description: describe(error, copyRef.current.failed.description),
            variant: "destructive",
          });
        } finally {
          setLoading(false);
        }
      } catch (error) {
        console.error("Failed to check Plex PIN:", error);
      }
    };

    const poll = setInterval(() => void check(), PIN_CHECK_INTERVAL_MS);

    const watchPopup = setInterval(() => {
      const popup = popupRef.current;
      if (!popup || !popup.closed) return;

      popupRef.current = null;
      clearInterval(watchPopup);
      void (async () => {
        await check();
        if (!settled) cancel();
      })();
    }, POPUP_CHECK_INTERVAL_MS);

    const expiry = setTimeout(
      () => {
        stop();
        toast({ ...copyRef.current.expired, variant: "destructive" });
      },
      Math.max(0, new Date(pin.expiresAt).getTime() - Date.now()),
    );

    void check();

    return () => {
      settled = true;
      clearInterval(poll);
      clearInterval(watchPopup);
      clearTimeout(expiry);
    };
  }, [pin, cancel, closePopup, stop, toast]);

  useEffect(() => {
    if (!redirectWhenPopupIsUnavailable) return;

    const resumed = readStoredPin();
    if (!resumed) return;

    pinRef.current = resumed;
    setPin(resumed);
    setLoading(true);
  }, [redirectWhenPopupIsUnavailable]);

  const redirect = useCallback((created: PlexPin) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(created));
    window.location.href = authUrl(created, window.location.href);
  }, []);

  const start = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch("/api/pg/auth/plex/pin", { method: "POST" });
      if (!response.ok) {
        throw new Error(
          "Could not reach Plex. Try again in a moment.",
        );
      }

      const created = (await response.json()) as PlexPin;
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      if (redirectWhenPopupIsUnavailable && isMobile) {
        redirect(created);
        return;
      }

      const left = window.screenX + (window.outerWidth - POPUP_WIDTH) / 2;
      const top = window.screenY + (window.outerHeight - POPUP_HEIGHT) / 2;
      const popup = window.open(
        authUrl(created),
        "PlexAuth",
        `width=${POPUP_WIDTH},height=${POPUP_HEIGHT},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`,
      );

      if (!popup) {
        if (redirectWhenPopupIsUnavailable) {
          redirect(created);
          return;
        }
        throw new Error(
          "Your browser blocked the Plex window. Allow pop-ups for this site and try again.",
        );
      }

      popupRef.current = popup;
      pinRef.current = created;
      setPin(created);
    } catch (error) {
      toast({
        title: copyRef.current.failed.title,
        description: describe(error, copyRef.current.failed.description),
        variant: "destructive",
      });
      setLoading(false);
    }
  }, [redirect, redirectWhenPopupIsUnavailable, toast]);

  return { loading, waiting: pin !== null, start, cancel };
};
