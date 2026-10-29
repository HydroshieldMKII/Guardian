import { config } from "@/lib/config";
import type { PortalDevice, PortalSettings, PortalUserRules } from "@/types";

interface PortalRulesResponse {
  enabled?: boolean;
  rules?: PortalUserRules | null;
}

const portalUrl = (path: string) => `${config.api.baseUrl}/user-portal/${path}`;

const getPortal = async <T>(path: string): Promise<T> => {
  const response = await fetch(portalUrl(path), { credentials: "include" });
  if (!response.ok) {
    throw new Error(`Failed to load the portal ${path}`);
  }
  return (await response.json()) as T;
};

const errorMessage = async (
  response: Response,
): Promise<string | undefined> => {
  try {
    const body = (await response.json()) as { message?: string };
    return body.message;
  } catch {
    return undefined;
  }
};

export const portalApi = {
  devices: () => getPortal<PortalDevice[]>("devices"),

  settings: () => getPortal<PortalSettings>("settings"),

  rules: async (): Promise<PortalUserRules | null> => {
    const response = await getPortal<PortalRulesResponse>("rules");
    return response.enabled && response.rules ? response.rules : null;
  },

  sendNote: async (deviceId: number, description: string): Promise<void> => {
    const response = await fetch(portalUrl(`devices/${deviceId}/request`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ description }),
    });
    if (!response.ok) {
      throw new Error(
        (await errorMessage(response)) || "Failed to submit request",
      );
    }
  },
};
