export interface VersionInfo {
  version: string;
  name: string;
  databaseVersion: string;
  codeVersion: string;
  isVersionMismatch: boolean;
}

export interface LatestRelease {
  version: string;
  url: string;
  notes: string;
}

export interface UpdateInfo {
  hasUpdate: boolean;
  latestVersion: string;
  currentVersion: string;
  updateUrl: string;
  releaseNotes: string;
}

const parseVersion = (version: string) => {
  const [core, ...prerelease] = version.split("-");
  return {
    parts: core.split(".").map((part) => parseInt(part) || 0),
    prerelease: prerelease.join("-"),
  };
};

export const isVersionNewer = (
  candidate: string,
  installed: string,
): boolean => {
  const next = parseVersion(candidate);
  const current = parseVersion(installed);

  for (let i = 0; i < Math.max(next.parts.length, current.parts.length); i++) {
    const nextPart = next.parts[i] || 0;
    const currentPart = current.parts[i] || 0;
    if (nextPart !== currentPart) return nextPart > currentPart;
  }

  if (next.prerelease === current.prerelease) return false;
  if (!next.prerelease) return true;
  if (!current.prerelease) return false;
  return (
    next.prerelease.localeCompare(current.prerelease, undefined, {
      numeric: true,
    }) > 0
  );
};

export const updateInfoFor = (
  release: LatestRelease,
  currentVersion: string,
): UpdateInfo => ({
  hasUpdate: isVersionNewer(release.version, currentVersion),
  latestVersion: release.version,
  currentVersion,
  updateUrl: release.url,
  releaseNotes: release.notes,
});
