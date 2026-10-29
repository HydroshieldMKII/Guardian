import { config } from "@/lib/config";
import type { AppSetting } from "@/types";

export const settingsApi = {
  list: async (): Promise<AppSetting[]> => {
    const response = await fetch(`${config.api.baseUrl}/config`);
    if (!response.ok) {
      throw new Error("Failed to fetch configuration");
    }
    return (await response.json()) as AppSetting[];
  },
};
