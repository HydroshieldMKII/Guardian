export const adminAccount = () => ({
  id: 'admin-1',
  username: 'testuser',
  email: 'v@example.com',
  avatarUrl: undefined,
  passwordHash: 'stored-hash',
});

export const storedSession = () => ({
  id: 'session-1',
  userId: 'admin-1',
  token: 'token-1',
  userType: 'admin' as const,
  expiresAt: new Date(Date.now() + 60_000),
  createdAt: new Date('2026-01-01T00:00:00Z'),
  lastActivityAt: new Date('2026-01-01T00:00:00Z'),
  plexUserId: null,
  plexUsername: null,
  plexThumb: null,
  user: adminAccount(),
});

export const sessionRepository = () => ({
  save: vi
    .fn()
    .mockImplementation((entity: Record<string, unknown>) =>
      Promise.resolve({ ...storedSession(), ...entity }),
    ),
  findOne: vi.fn().mockResolvedValue(storedSession()),
  remove: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue({ affected: 3 }),
});
