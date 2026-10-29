const STALE_ENTRY_THRESHOLD_MS = 24 * 60 * 60 * 1000;

interface DeviceRef {
  userId: string;
  deviceIdentifier: string;
}

const keyOf = ({ userId, deviceIdentifier }: DeviceRef): string =>
  `${userId}:${deviceIdentifier}`;

export class SessionKeyRegistry {
  private readonly knownKeys = new Map<string, Set<string>>();
  private readonly lastActivity = new Map<string, number>();

  recordSession(
    device: DeviceRef,
    sessionKey: string,
    storedSessionKey: string | null,
  ): boolean {
    const deviceKey = keyOf(device);
    let keys = this.knownKeys.get(deviceKey);
    if (!keys) {
      keys = new Set(storedSessionKey ? [storedSessionKey] : []);
      this.knownKeys.set(deviceKey, keys);
    }
    this.lastActivity.set(deviceKey, Date.now());

    if (keys.has(sessionKey)) {
      return false;
    }
    keys.add(sessionKey);
    return true;
  }

  forget(device: DeviceRef, sessionKey: string): void {
    this.knownKeys.get(keyOf(device))?.delete(sessionKey);
  }

  pruneStale(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [deviceKey, lastActivity] of this.lastActivity) {
      if (now - lastActivity > STALE_ENTRY_THRESHOLD_MS) {
        this.knownKeys.delete(deviceKey);
        this.lastActivity.delete(deviceKey);
        pruned++;
      }
    }
    return pruned;
  }
}
