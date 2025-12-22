import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserPortalService } from './services/user-portal.service';

/**
 * User Portal Controller
 * Handles endpoints for Plex users (non-admin) logged in via OAuth
 * All endpoints here are accessible by both admin and plex_user sessions
 * but the data returned is scoped to the logged-in user's Plex ID
 */
@Controller('user-portal')
export class UserPortalController {
  constructor(private readonly userPortalService: UserPortalService) {}

  /**
   * Get current user's devices
   */
  @Get('devices')
  async getMyDevices(@Req() req: Request) {
    const plexUserId = this.extractPlexUserId(req);
    return this.userPortalService.getUserDevices(plexUserId);
  }

  /**
   * Get current user's all rules (user preferences + time rules)
   * User-level rules are returned at the top level
   * Device-specific rules are included in the devices endpoint
   */
  @Get('rules')
  async getMyRules(@Req() req: Request) {
    const plexUserId = this.extractPlexUserId(req);
    const rules = await this.userPortalService.getUserRules(plexUserId);

    if (rules === null) {
      return { enabled: false, rules: null };
    }

    return { enabled: true, rules };
  }

  /**
   * Request approval for a device
   */
  @Post('devices/:id/request')
  async requestDeviceApproval(
    @Req() req: Request,
    @Param('id', ParseIntPipe) deviceId: number,
    @Body() body: { description?: string },
  ) {
    const plexUserId = this.extractPlexUserId(req);

    await this.userPortalService.requestDeviceApproval(
      plexUserId,
      deviceId,
      body.description,
    );

    return { success: true, message: 'Approval request submitted' };
  }

  /**
   * Get portal settings
   */
  @Get('settings')
  async getPortalSettings() {
    return this.userPortalService.getPortalSettings();
  }

  /**
   * Extract Plex user ID from the request
   * Works for both admin sessions (with linked Plex) and plex_user sessions
   */
  private extractPlexUserId(req: Request): string {
    const user = req.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    // For plex_user sessions, use the plexUserId directly
    if (user.userType === 'plex_user') {
      return user.plexUserId;
    }

    // For admin sessions, they must have a linked Plex account
    if (user.userType === 'admin') {
      const adminUser = user as any;
      if (adminUser.plexUserId) {
        return adminUser.plexUserId;
      }
      throw new ForbiddenException(
        'Admin account not linked to Plex. Link your Plex account in profile settings to view your devices.',
      );
    }

    throw new ForbiddenException('Invalid session type');
  }
}
