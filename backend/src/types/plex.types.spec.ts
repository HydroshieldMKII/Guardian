import { PlexSession, isPlexampSession } from './plex.types';

const session = (product?: string): PlexSession => ({
  Player: { machineIdentifier: 'device-a', product },
});

describe('isPlexampSession', () => {
  it('detects Plexamp from a session', () => {
    expect(isPlexampSession(session('Plexamp'))).toBe(true);
  });

  it('rejects another product', () => {
    expect(isPlexampSession(session('Plex Web'))).toBe(false);
  });

  it('rejects a session with no product', () => {
    expect(isPlexampSession(session())).toBe(false);
  });

  it('rejects a session with no player', () => {
    expect(isPlexampSession({})).toBe(false);
  });

  it('detects Plexamp from a product string', () => {
    expect(isPlexampSession('Plexamp')).toBe(true);
  });

  it('rejects a different product string', () => {
    expect(isPlexampSession('Plex for Roku')).toBe(false);
  });

  it('is case sensitive', () => {
    expect(isPlexampSession('plexamp')).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isPlexampSession(undefined)).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isPlexampSession('')).toBe(false);
  });
});
