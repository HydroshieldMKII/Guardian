interface TurnstileRenderOptions {
  sitekey: string;
  theme?: "light" | "dark" | "auto";
}

export interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
  getResponse: (widgetId: string) => string;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

export const TURNSTILE_SCRIPT_ID = "turnstile-script";
export const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js";

export function turnstileScript(): HTMLScriptElement {
  const existing = document.getElementById(TURNSTILE_SCRIPT_ID);
  if (existing instanceof HTMLScriptElement) return existing;

  const script = document.createElement("script");
  script.id = TURNSTILE_SCRIPT_ID;
  script.src = TURNSTILE_SCRIPT_URL;
  script.async = true;
  script.defer = true;
  document.head.appendChild(script);
  return script;
}
