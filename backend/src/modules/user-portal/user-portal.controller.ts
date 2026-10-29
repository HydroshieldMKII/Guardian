import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Req,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserPortalService } from '@/modules/user-portal/services/user-portal.service';
import { AuthGuard } from '@/modules/auth/guards/auth.guard';
import { DeviceNoteDto } from '@/modules/user-portal/dto/device-note.dto';

@Controller('user-portal')
@UseGuards(AuthGuard)
export class UserPortalController {
  constructor(private readonly userPortalService: UserPortalService) {}

  @Get('devices')
  async getMyDevices(@Req() req: Request) {
    const plexUserId = this.extractPlexUserId(req);
    return this.userPortalService.getUserDevices(plexUserId);
  }

  @Get('rules')
  async getMyRules(@Req() req: Request) {
    const plexUserId = this.extractPlexUserId(req);
    const rules = await this.userPortalService.getUserRules(plexUserId);

    if (rules === null) {
      return { enabled: false, rules: null };
    }

    return { enabled: true, rules };
  }

  @Post('devices/:id/request')
  async requestDeviceApproval(
    @Req() req: Request,
    @Param('id', ParseIntPipe) deviceId: number,
    @Body() body: DeviceNoteDto,
  ) {
    const plexUserId = this.extractPlexUserId(req);

    await this.userPortalService.requestDeviceApproval(
      plexUserId,
      deviceId,
      body.description,
    );

    return { success: true, message: 'Approval request submitted' };
  }

  @Get('settings')
  async getPortalSettings() {
    return this.userPortalService.getPortalSettings();
  }

  private extractPlexUserId(req: Request): string {
    const user = req.user;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (user.userType === 'plex_user') {
      return user.plexUserId;
    }

    if (user.userType === 'admin') {
      if (user.plexUserId) {
        return user.plexUserId;
      }
      throw new ForbiddenException(
        'Admin account not linked to Plex. Link your Plex account in profile settings to view your devices.',
      );
    }

    throw new ForbiddenException('Invalid session type');
  }
}
