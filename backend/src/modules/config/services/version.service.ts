import { Injectable, Logger } from '@nestjs/common';

// App version
const CURRENT_APP_VERSION = '1.2.3';

@Injectable()
export class VersionService {
  private readonly logger = new Logger(VersionService.name);

  getCurrentAppVersion(): string {
    return CURRENT_APP_VERSION;
  }

  compareVersions(version1: string, version2: string): number {
    const parseVersion = (version: string): number[] => {
      return version.split('.').map((v) => parseInt(v) || 0);
    };

    const v1Parts = parseVersion(version1);
    const v2Parts = parseVersion(version2);
    const maxLength = Math.max(v1Parts.length, v2Parts.length);

    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;

      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }

    return 0; // versions are equal
  }

  async updateAppVersionIfNewer(
    currentDbVersion: string,
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
        this.logger.log(`App version is up to date: ${CURRENT_APP_VERSION}`);
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
