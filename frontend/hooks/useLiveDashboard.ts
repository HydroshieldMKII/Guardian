"use client";

import { useEffect, useRef, useState } from "react";

export const LIVE_URL = "/api/pg/live";
export const DASHBOARD_EVENT = "dashboard";

export interface LiveDashboard<T> {
  connected: boolean;
  lastUpdate: T | null;
}

/**
 * Subscribes to server-pushed dashboard updates over Server-Sent Events.
 *
 * Callers keep polling while `connected` is false, so a dropped stream
 * degrades to the previous behaviour rather than a frozen page. EventSource
 * reconnects on its own, which flips `connected` back without extra work.
 */
export function useLiveDashboard<T>(
  onUpdate: (payload: T) => void,
  enabled = true,
): LiveDashboard<T> {
  const [connected, setConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<T | null>(null);
  const handlerRef = useRef(onUpdate);
  handlerRef.current = onUpdate;

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") {
      setConnected(false);
      return;
    }

    let source: EventSource;
    try {
      source = new EventSource(LIVE_URL, { withCredentials: true });
    } catch {
      setConnected(false);
      return;
    }

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.addEventListener(DASHBOARD_EVENT, (event) => {
      let payload: T;
      try {
        payload = JSON.parse((event as MessageEvent<string>).data) as T;
      } catch {
        return;
      }

      setConnected(true);
      setLastUpdate(payload);
      handlerRef.current(payload);
    });

    return () => {
      source.close();
      setConnected(false);
    };
  }, [enabled]);

  return { connected, lastUpdate };
}
