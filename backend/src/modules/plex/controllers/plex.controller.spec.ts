import { Test } from '@nestjs/testing';
import type { Response } from 'express';
import { PlexController } from '@/modules/plex/controllers/plex.controller';
import { PlexClient } from '@/modules/plex/services/plex-client';
import { PlexService } from '@/modules/plex/services/plex.service';

describe('PlexController', () => {
  let controller: PlexController;
  let plexClient: { requestMedia: jest.Mock };
  let plexService: { getPlexWebUrl: jest.Mock };

  const responseStub = () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const setHeader = jest.fn();
    const send = jest.fn();
    const stub: Pick<Response, 'status' | 'setHeader' | 'send'> = {
      status,
      setHeader,
      send,
    };
    return { res: stub as Response, status, json, setHeader, send };
  };

  beforeEach(async () => {
    plexClient = {
      requestMedia: jest.fn().mockResolvedValue(Buffer.from('image-bytes')),
    };
    plexService = {
      getPlexWebUrl: jest.fn().mockResolvedValue('https://app.plex.tv'),
    };

    const module = await Test.createTestingModule({
      controllers: [PlexController],
      providers: [
        { provide: PlexClient, useValue: plexClient },
        { provide: PlexService, useValue: plexService },
      ],
    }).compile();

    controller = module.get(PlexController);
  });

  describe('getMedia', () => {
    it.each(['thumb', 'art'])('serves a %s image', async (type) => {
      const { res, setHeader, send } = responseStub();
      await controller.getMedia(type, '1234', '', res);

      expect(plexClient.requestMedia).toHaveBeenCalledWith(
        `library/metadata/1234/${type}`,
      );
      expect(setHeader).toHaveBeenCalledWith('Content-Type', 'image/jpeg');
      expect(send).toHaveBeenCalledWith(Buffer.from('image-bytes'));
    });

    it('appends the cache-busting timestamp to the endpoint', async () => {
      const { res } = responseStub();
      await controller.getMedia('thumb', '1234', '99', res);

      expect(plexClient.requestMedia).toHaveBeenCalledWith(
        'library/metadata/1234/thumb/99',
      );
    });

    it('sets a one-hour cache header and the content length', async () => {
      const { res, setHeader } = responseStub();
      await controller.getMedia('thumb', '1234', '', res);

      expect(setHeader).toHaveBeenCalledWith(
        'Cache-Control',
        'public, max-age=3600',
      );
      expect(setHeader).toHaveBeenCalledWith('Content-Length', 11);
    });

    it('rejects an unsupported media type with a 400', async () => {
      const { res, status, json } = responseStub();
      await controller.getMedia('banner', '1234', '', res);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({
        error: 'Invalid media type. Must be thumb or art.',
      });
      expect(plexClient.requestMedia).not.toHaveBeenCalled();
    });

    it('returns a 404 when Plex has no such media', async () => {
      plexClient.requestMedia.mockResolvedValue(null);
      const { res, status, json } = responseStub();
      await controller.getMedia('thumb', '1234', '', res);

      expect(status).toHaveBeenCalledWith(404);
      expect(json).toHaveBeenCalledWith({ error: 'Media not found' });
    });

    it('returns a 500 when the fetch throws', async () => {
      plexClient.requestMedia.mockRejectedValue(new Error('offline'));
      const { res, status, json } = responseStub();
      await controller.getMedia('thumb', '1234', '', res);

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({ error: 'Failed to fetch media' });
    });
  });

  describe('getPlexWebUrl', () => {
    it('returns the resolved url', async () => {
      await expect(controller.getPlexWebUrl()).resolves.toEqual({
        webUrl: 'https://app.plex.tv',
      });
    });

    it('degrades to a null url on failure', async () => {
      plexService.getPlexWebUrl.mockRejectedValue(new Error('offline'));
      await expect(controller.getPlexWebUrl()).resolves.toEqual({
        webUrl: null,
        error: 'Failed to get Plex web URL',
      });
    });
  });
});
