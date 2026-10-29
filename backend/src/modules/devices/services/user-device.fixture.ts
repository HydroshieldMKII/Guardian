import { UserDevice } from '@/entities/user-device.entity';

export const userDevice = (overrides: Partial<UserDevice> = {}): UserDevice =>
  Object.assign(new UserDevice(), {
    id: 1,
    userId: 'u1',
    username: 'testuser',
    deviceIdentifier: 'dev-1',
    deviceName: 'Living Room TV',
    devicePlatform: 'Android',
    deviceProduct: 'Plex for Android',
    deviceVersion: '10.0',
    status: 'pending',
    sessionCount: 1,
    currentSessionKey: null,
    ipAddress: '10.0.0.5',
    firstSeen: new Date('2026-01-01T00:00:00Z'),
    lastSeen: new Date('2026-08-01T00:00:00Z'),
    excludeFromConcurrentLimit: false,
    temporaryAccessUntil: null,
    ...overrides,
  });
