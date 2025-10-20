import { Controller, Get, Param, Res, Query, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { PlexClient } from '../services/plex-client';
import { PlexService } from '../services/plex.service';

@Controller('plex')
export class PlexController {
  private readonly logger = new Logger(PlexController.name);

  constructor(
    private readonly plexClient: PlexClient,
    private readonly plexService: PlexService,
  ) {}

  @Get('media/:type/:ratingKey')
  async getMedia(
    @Param('type') type: string, // 'thumb' or 'art'
    @Param('ratingKey') ratingKey: string,
    @Query('t') timestamp: string,
    @Res() res: Response,
  ) {
    try {
      if (!['thumb', 'art'].includes(type)) {
        return res
          .status(400)
          .json({ error: 'Invalid media type. Must be thumb or art.' });
      }

      // Build the media endpoint
      let endpoint = `library/metadata/${ratingKey}/${type}`;
      if (timestamp) {
        endpoint += `/${timestamp}`;
      }

      const mediaBuffer = await this.plexClient.requestMedia(endpoint);

      if (!mediaBuffer) {
        return res.status(404).json({ error: 'Media not found' });
      }

      res.setHeader('Content-Type', 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      res.setHeader('Content-Length', mediaBuffer.length);

      return res.send(mediaBuffer);
    } catch (error) {
      this.logger.error(
        `Failed to fetch ${type} for ratingKey ${ratingKey}:`,
        error,
      );
      return res.status(500).json({ error: 'Failed to fetch media' });
    }
  }

  @Get('web-url')
  async getPlexWebUrl() {
    try {
      const webUrl = await this.plexService.getPlexWebUrl();
      return { webUrl };
    } catch (error) {
      this.logger.error('Failed to get Plex web URL:', error);
      return { webUrl: null, error: 'Failed to get Plex web URL' };
    }
  }
}
