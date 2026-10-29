import { useEffect, useRef, useState } from "react";
import { turnstileScript } from "@/lib/turnstile";

interface TurnstileKeyResponse {
  siteKey?: string;
}

export function useTurnstile(theme: string) {
  const [siteKey, setSiteKey] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    const fetchSiteKey = async () => {
      try {
        const response = await fetch("/api/pg/auth/turnstile-key");
        if (response.ok) {
          const data = (await response.json()) as TurnstileKeyResponse;
          if (data.siteKey) {
            setSiteKey(data.siteKey);
          }
        }
      } catch (error) {
        console.error("Failed to fetch Turnstile site key:", error);
      }
    };

    void fetchSiteKey();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!siteKey || !container) return;

    const script = turnstileScript();
    const renderWidget = () => {
      if (!window.turnstile || widgetIdRef.current) return;
      widgetIdRef.current = window.turnstile.render(container, {
        sitekey: siteKey,
        theme: theme === "dark" ? "dark" : "light",
      });
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      script.addEventListener("load", renderWidget);
    }

    return () => {
      script.removeEventListener("load", renderWidget);
      const widgetId = widgetIdRef.current;
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, theme]);

  const withWidget = <T>(action: (widgetId: string) => T) => {
    const widgetId = widgetIdRef.current;
    return widgetId && window.turnstile ? action(widgetId) : undefined;
  };

  return {
    siteKey,
    containerRef,
    token: () => withWidget((id) => window.turnstile?.getResponse(id)),
    reset: () => withWidget((id) => window.turnstile?.reset(id)),
  };
}
