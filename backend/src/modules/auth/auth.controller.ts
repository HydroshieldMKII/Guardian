import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Res,
  Req,
  BadRequestException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '@/modules/auth/auth.service';
import { AuthSessionService } from '@/modules/auth/auth-session.service';
import { ConfigService } from '@/modules/config/services/config.service';
import { CreateAdminDto } from '@/modules/auth/dto/create-admin.dto';
import { LoginDto } from '@/modules/auth/dto/login.dto';
import { UpdateProfileDto } from '@/modules/auth/dto/update-profile.dto';
import { UpdatePasswordDto } from '@/modules/auth/dto/update-password.dto';
import { AuthResponseDto } from '@/modules/auth/dto/session.dto';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { Public } from '@/modules/auth/decorators/public.decorator';
import { AdminOnly } from '@/modules/auth/decorators/admin-only.decorator';
import {
  AdminSessionUser,
  SessionUser,
} from '@/modules/auth/session-user.types';
import {
  SESSION_COOKIE_NAME,
  extractSessionToken,
  sessionCookieOptions,
  setSessionCookie,
} from '@/modules/auth/session-cookie';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private authSessions: AuthSessionService,
    private configService: ConfigService,
  ) {}

  @Public()
  @Get('check-setup')
  async checkSetup() {
    const hasAdmin = await this.authService.hasAdminUsers();
    return {
      setupRequired: !hasAdmin,
    };
  }

  @Public()
  @Get('turnstile-key')
  async getTurnstileKey() {
    const siteKey = await this.configService.getSetting(
      'CLOUDFLARE_TURNSTILE_SITE_KEY',
    );
    return {
      siteKey: siteKey || '',
    };
  }

  @Public()
  @Post('create-admin')
  async createAdmin(
    @Body() dto: CreateAdminDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.createAdmin(dto);
    return this.issueSession(req, res, result);
  }

  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);
    return this.issueSession(req, res, result);
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = extractSessionToken(req);

    if (token) {
      await this.authSessions.logout(token);
    }

    res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions(req));

    return { success: true };
  }

  @Get('me')
  getCurrentUser(@CurrentUser() user: SessionUser | undefined) {
    if (!user) {
      throw new BadRequestException('Not authenticated');
    }

    if (user.userType === 'plex_user') {
      return {
        plexUserId: user.plexUserId,
        plexUsername: user.plexUsername,
        plexThumb: user.plexThumb,
      };
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
      plexUserId: user.plexUserId,
      plexUsername: user.plexUsername,
      plexEmail: user.plexEmail,
      plexThumb: user.plexThumb,
    };
  }

  @AdminOnly()
  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: AdminSessionUser | undefined,
    @Body() dto: UpdateProfileDto,
  ) {
    if (!user) {
      throw new BadRequestException('Not authenticated');
    }

    const updatedUser = await this.authService.updateProfile(user.id, dto);
    return updatedUser;
  }

  @AdminOnly()
  @Patch('password')
  async updatePassword(
    @CurrentUser() user: AdminSessionUser | undefined,
    @Body() dto: UpdatePasswordDto,
  ) {
    if (!user) {
      throw new BadRequestException('Not authenticated');
    }

    await this.authService.updatePassword(user.id, dto, user.sessionId);
    return { success: true };
  }

  private issueSession(req: Request, res: Response, result: AuthResponseDto) {
    setSessionCookie(req, res, result.session.token);
    return {
      user: result.user,
      session: {
        expiresAt: result.session.expiresAt,
      },
    };
  }
}
