import { Injectable, Logger } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';

const RELEASE_VERSION_PATTERN = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

export function nearestPackageJson(start: string): string {
  let directory = start;
  while (true) {
    const candidate = join(directory, 'package.json');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(directory);
    if (parent === directory) {
      throw new Error(`No package.json found above ${start}`);
    }
    directory = parent;
  }
}

function packageVersion(): string {
  const manifest = JSON.parse(
    readFileSync(nearestPackageJson(__dirname), 'utf8'),
  ) as { version: string };
  return manifest.version;
}

export function resolveAppVersion(raw: string | undefined): string {
  const version = raw?.trim().replace(/^v/, '');
  return version && RELEASE_VERSION_PATTERN.test(version)
    ? version
    : packageVersion();
}

const CURRENT_APP_VERSION = resolveAppVersion(process.env.GUARDIAN_VERSION);

@Injectable()
export class VersionService {
  private readonly logger = new Logger(VersionService.name);

  getCurrentAppVersion(): string {
    return CURRENT_APP_VERSION;
  }

  compareVersions(version1: string | null, version2: string | null): number {
    const parseVersion = (version: string | null) => {
      const [core, ...prerelease] = (version ?? '').split('-');
      return {
        parts: core.split('.').map((v) => parseInt(v) || 0),
        prerelease: prerelease.join('-'),
      };
    };

    const v1 = parseVersion(version1);
    const v2 = parseVersion(version2);
    const maxLength = Math.max(v1.parts.length, v2.parts.length);

    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1.parts[i] || 0;
      const v2Part = v2.parts[i] || 0;

      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }

    if (v1.prerelease === v2.prerelease) return 0;
    if (!v1.prerelease) return 1;
    if (!v2.prerelease) return -1;
    return Math.sign(
      v1.prerelease.localeCompare(v2.prerelease, undefined, { numeric: true }),
    );
  }

  async updateAppVersionIfNewer(
    currentDbVersion: string | null,
    updateVersionCallback: (newVersion: string) => Promise<void>,
  ): Promise<void> {
    try {
      if (this.compareVersions(CURRENT_APP_VERSION, currentDbVersion) > 0) {
        this.logger.log(
          `Updating app version from ${currentDbVersion} to: ${CURRENT_APP_VERSION}`,
        );
        await updateVersionCallback(CURRENT_APP_VERSION);
        this.logger.log('App version updated successfully');
      } else if (
        this.compareVersions(CURRENT_APP_VERSION, currentDbVersion) < 0
      ) {
        this.logger.error(
          `WARNING: Current app version ${CURRENT_APP_VERSION} is older than your data version ${currentDbVersion}. Please check your installation.`,
        );
      } else {
        this.logger.log(
          `App version is up to date with database: ${CURRENT_APP_VERSION}`,
        );
      }
    } catch (error) {
      this.logger.warn('Failed to update app version:', error);
    }
  }

  getVersionInfo(databaseVersion: string): {
    version: string;
    databaseVersion: string;
    codeVersion: string;
    isVersionMismatch: boolean;
  } {
    // Version mismatch occurs when database version > current code version (downgrade scenario)
    const isVersionMismatch =
      this.compareVersions(databaseVersion, CURRENT_APP_VERSION) > 0;

    return {
      version: CURRENT_APP_VERSION,
      databaseVersion,
      codeVersion: CURRENT_APP_VERSION,
      isVersionMismatch,
    };
  }
}
