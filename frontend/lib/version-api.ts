import { config } from "@/lib/config";
import type { LatestRelease, VersionInfo } from "@/lib/version";

const LATEST_RELEASE_URL =
  "https://api.github.com/repos/HydroshieldMKII/Guardian/releases/latest";

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  body?: string | null;
}

export const versionApi = {
  info: async (): Promise<VersionInfo> => {
    const response = await fetch(`${config.api.baseUrl}/config/version`);
    if (!response.ok) {
      throw new Error(`Failed to fetch version info: ${response.status}`);
    }
    return (await response.json()) as VersionInfo;
  },

  latestRelease: async (): Promise<LatestRelease> => {
    const response = await fetch(LATEST_RELEASE_URL);
    if (!response.ok) {
      throw new Error(`Failed to check for updates: ${response.status}`);
    }
    const release = (await response.json()) as GitHubRelease;
    return {
      version: release.tag_name.replace(/^v/, ""),
      url: release.html_url,
      notes: release.body ?? "",
    };
  },
};
