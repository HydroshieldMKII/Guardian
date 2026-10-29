import type { PlexSession } from '@/types/plex.types';

export const isPlexampProduct = (product?: string | null): boolean =>
  product?.toLowerCase().includes('plexamp') ?? false;

export const isPlexampDevice = ({
  deviceProduct,
}: {
  deviceProduct?: string | null;
}): boolean => isPlexampProduct(deviceProduct);

const MUSIC_TYPE = 'track';

export const isPlexampSession = (session?: PlexSession): boolean =>
  isPlexampProduct(session?.Player?.product) && session?.type === MUSIC_TYPE;
