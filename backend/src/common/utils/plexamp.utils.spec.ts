import { isPlexampDevice } from '@/common/utils/plexamp.utils';

describe('isPlexampDevice', () => {
  it.each([
    [{ deviceProduct: 'Plexamp', deviceName: 'Phone' }],
    [{ deviceProduct: 'Plex for iOS', deviceName: 'Kitchen PlexAmp' }],
    [{ deviceProduct: null, deviceName: 'plexamp' }],
  ])('recognises %o', (device) => {
    expect(isPlexampDevice(device)).toBe(true);
  });

  it.each([
    [{ deviceProduct: 'Plex for Android', deviceName: 'Living Room TV' }],
    [{ deviceProduct: null, deviceName: null }],
    [{}],
  ])('rejects %o', (device) => {
    expect(isPlexampDevice(device)).toBe(false);
  });
});
