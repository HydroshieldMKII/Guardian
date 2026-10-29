import {
  isPlexampDevice,
  isPlexampProduct,
  isPlexampSession,
} from '@/common/utils/plexamp.utils';

describe('isPlexampProduct', () => {
  it.each(['Plexamp', 'plexamp', 'PLEXAMP'])('recognises %s', (product) => {
    expect(isPlexampProduct(product)).toBe(true);
  });

  it.each(['Plex Web', 'Plex for Android', '', null, undefined])(
    'rejects %p',
    (product) => {
      expect(isPlexampProduct(product)).toBe(false);
    },
  );
});

describe('isPlexampDevice', () => {
  it('recognises a device by its product', () => {
    const device = { deviceProduct: 'Plexamp', deviceName: 'Phone' };
    expect(isPlexampDevice(device)).toBe(true);
  });

  it.each([
    [{ deviceProduct: 'Plex for iOS', deviceName: 'Kitchen PlexAmp' }],
    [{ deviceProduct: null, deviceName: 'plexamp' }],
  ])('ignores a name the user picked: %o', (device) => {
    expect(isPlexampDevice(device)).toBe(false);
  });

  it.each([[{ deviceProduct: null }], [{}]])('rejects %o', (device) => {
    expect(isPlexampDevice(device)).toBe(false);
  });
});

describe('isPlexampSession', () => {
  it('recognises a session played from Plexamp', () => {
    expect(isPlexampSession({ Player: { product: 'Plexamp' } })).toBe(true);
  });

  it('matches the product whatever its case', () => {
    expect(isPlexampSession({ Player: { product: 'plexamp' } })).toBe(true);
  });

  it('ignores a player title the user picked', () => {
    expect(
      isPlexampSession({ Player: { product: 'Plex Web', title: 'Plexamp' } }),
    ).toBe(false);
  });

  it.each([[{}], [{ Player: {} }], [undefined]])('rejects %o', (session) => {
    expect(isPlexampSession(session)).toBe(false);
  });
});
