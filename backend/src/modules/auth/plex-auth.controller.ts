import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Res,
  Req,
  Param,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { PlexOAuthService } from '@/modules/auth/plex-oauth.service';
import { PlexLoginService } from '@/modules/auth/plex-login.service';
import { PlexAccountService } from '@/modules/auth/plex-account.service';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { Public } from '@/modules/auth/decorators/public.decorator';
import { AdminOnly } from '@/modules/auth/decorators/admin-only.decorator';
import { AdminUser } from '@/entities/admin-user.entity';
import { setSessionCookie } from '@/modules/auth/session-cookie';
import { rethrowAsBadRequest } from '@/modules/auth/rethrow-as-bad-request';

@Controller('auth/plex')
export class PlexAuthController {
  constructor(
    private plexOAuthService: PlexOAuthService,
    private plexLoginService: PlexLoginService,
    private plexAccounts: PlexAccountService,
  ) {}

  @Public()
  @Get('enabled')
  async checkPlexOAuthEnabled() {
    return { enabled: await this.plexLoginService.isEnabled() };
  }

  @Public()
  @Post('pin')
  async createPlexPin() {
    try {
      const clientId = this.plexOAuthService.generateClientId();
      const pinData = await this.plexOAuthService.createPlexPin(clientId);
      return {
        id: pinData.pin.id,
        code: pinData.pin.code,
        clientId: pinData.pin.clientIdentifier,
        expiresAt: pinData.pin.expiresAt.toISOString(),
      };
    } catch (error) {
      rethrowAsBadRequest(error, 'Failed to create Plex PIN');
    }
  }

  @Public()
  @Get('pin/:clientId')
  async checkPlexPin(@Param('clientId') clientId: string) {
    try {
      const plexUser = await this.plexOAuthService.checkPlexPin(clientId);
      if (plexUser) {
        return {
          authenticated: true,
          authToken: plexUser.authToken,
        };
      }
      return { authenticated: false };
    } catch (error) {
      rethrowAsBadRequest(error, 'Failed to check Plex PIN');
    }
  }

  @Public()
  @Delete('pin/:clientId')
  cancelPlexPin(@Param('clientId') clientId: string) {
    this.plexOAuthService.cancelPlexPin(clientId);
    return { cancelled: true };
  }

  @Public()
  @Post('login')
  async plexLogin(
    @Body() body: { authToken: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!body.authToken) {
      throw new BadRequestException('Auth token is required');
    }

    try {
      const login = await this.plexLoginService.login(body.authToken);
      setSessionCookie(req, res, login.token);
      return login.body;
    } catch (error) {
      rethrowAsBadRequest(error, 'Failed to complete Plex login');
    }
  }

  @AdminOnly()
  @Post('link')
  async linkPlexAccount(
    @CurrentUser() user: AdminUser,
    @Body() body: { authToken: string },
  ) {
    if (!body.authToken) {
      throw new BadRequestException('Plex auth token is required');
    }

    try {
      const plexUser = await this.plexOAuthService.getPlexUserFromToken(
        body.authToken,
      );
      const result = await this.plexAccounts.linkPlexAccountToAdmin(
        user.id,
        plexUser,
      );
      return {
        plexUserId: result.plexUserId,
        plexUsername: result.plexUsername,
        plexEmail: result.plexEmail,
        plexThumb: result.plexThumb,
      };
    } catch (error) {
      rethrowAsBadRequest(error, 'Failed to link Plex account');
    }
  }

  @AdminOnly()
  @Delete('link')
  async unlinkPlexAccount(@CurrentUser() user: AdminUser) {
    try {
      await this.plexAccounts.unlinkPlexAccountFromAdmin(user.id);
      return { success: true };
    } catch (error) {
      rethrowAsBadRequest(error, 'Failed to unlink Plex account');
    }
  }

  @AdminOnly()
  @Get('link')
  getLinkedPlexAccount(@CurrentUser() user: AdminUser) {
    if (user.plexUserId) {
      return {
        linked: true,
        plexUserId: user.plexUserId,
        plexUsername: user.plexUsername,
        plexEmail: user.plexEmail,
        plexThumb: user.plexThumb,
      };
    }

    return { linked: false };
  }
}
