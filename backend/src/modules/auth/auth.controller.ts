import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Res,
  Req,
  Param,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '@/modules/auth/auth.service';
import { PlexOAuthService } from '@/modules/auth/plex-oauth.service';
import { PasswordResetService } from '@/modules/auth/password-reset.service';
import { ConfigService } from '@/modules/config/services/config.service';
import { CreateAdminDto } from '@/modules/auth/dto/create-admin.dto';
import { LoginDto } from '@/modules/auth/dto/login.dto';
import { UpdateProfileDto } from '@/modules/auth/dto/update-profile.dto';
import { UpdatePasswordDto } from '@/modules/auth/dto/update-password.dto';
import {
  ConfirmPasswordResetDto,
  RequestPasswordResetDto,
  VerifyPasswordResetDto,
} from '@/modules/auth/dto/password-reset.dto';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { Public } from '@/modules/auth/decorators/public.decorator';
import { AdminOnly } from '@/modules/auth/decorators/admin-only.decorator';
import { AdminUser } from '@/entities/admin-user.entity';
import {
  AdminSessionUser,
  SessionUser,
} from '@/modules/auth/session-user.types';
import {
  SESSION_COOKIE_NAME,
  extractSessionToken,
  sessionCookieOptions,
} from '@/modules/auth/session-cookie';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private plexOAuthService: PlexOAuthService,
    private passwordResetService: PasswordResetService,
    private configService: ConfigService,
  ) {}

  /**
   * Check setup status - returns whether admin exists
   */
  @Public()
  @Get('check-setup')
  async checkSetup() {
    const hasAdmin = await this.authService.hasAdminUsers();
    return {
      setupRequired: !hasAdmin,
    };
  }

  /**
   * Get Cloudflare Turnstile site key
   */
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

  /**
   * Create initial admin account
   * Only accessible if no admin exists
   */
  @Public()
  @Post('create-admin')
  async createAdmin(
    @Body() dto: CreateAdminDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.createAdmin(dto);

    res.cookie(
      SESSION_COOKIE_NAME,
      result.session.token,
      sessionCookieOptions(req),
    );

    return {
      user: result.user,
      session: {
        expiresAt: result.session.expiresAt,
      },
    };
  }

  /**
   * Login endpoint
   */
  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);

    res.cookie(
      SESSION_COOKIE_NAME,
      result.session.token,
      sessionCookieOptions(req),
    );

    return {
      user: result.user,
      session: {
        expiresAt: result.session.expiresAt,
      },
    };
  }

  /**
   * Logout endpoint
   */
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = extractSessionToken(req);

    if (token) {
      await this.authService.logout(token);
    }

    res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions(req));

    return { success: true };
  }

  /**
   * Get current user
   */
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

  /**
   * Update user profile
   */
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

  /**
   * Update user password
   */
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

  // ==========================================
  // Password Reset Endpoints
  // ==========================================

  /**
   * Whether the password reset flow can be offered on the login page
   */
  @Public()
  @Get('password-reset/status')
  async passwordResetStatus() {
    return this.passwordResetService.getStatus();
  }

  /**
   * Start a password reset
   * Always reports success so the response cannot be used to probe for accounts
   */
  @Public()
  @Post('password-reset/request')
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    await this.passwordResetService.requestReset(dto.email);
    return { success: true };
  }

  /**
   * Check whether a reset link is still usable before showing the form
   */
  @Public()
  @Post('password-reset/verify')
  async verifyPasswordReset(@Body() dto: VerifyPasswordResetDto) {
    return { valid: await this.passwordResetService.verify(dto.token) };
  }

  /**
   * Set a new password from a reset link
   */
  @Public()
  @Post('password-reset/confirm')
  async confirmPasswordReset(@Body() dto: ConfirmPasswordResetDto) {
    await this.passwordResetService.confirm(dto);
    return { success: true };
  }

  private rethrowAsBadRequest(error: unknown, fallback: string): never {
    if (error instanceof UnauthorizedException) {
      throw error;
    }
    throw new BadRequestException(
      error instanceof Error ? error.message : fallback,
    );
  }

  // ==========================================
  // Plex OAuth Endpoints
  // ==========================================

  /**
   * Check if Plex OAuth login is enabled
   * Enabled if: admin has linked their Plex account OR user portal is enabled
   */
  @Public()
  @Get('plex/enabled')
  async checkPlexOAuthEnabled() {
    // Check if admin has linked their Plex account
    const adminWithPlex = await this.plexOAuthService.getAdminWithPlexLinked();
    if (adminWithPlex) {
      return { enabled: true };
    }

    // Check if user portal is enabled
    const userPortalEnabled = await this.configService.getSetting(
      'USER_PORTAL_ENABLED',
    );

    return { enabled: userPortalEnabled === true };
  }

  /**
   * Create a Plex OAuth PIN for authentication
   * Used both for admin linking and user login
   */
  @Public()
  @Post('plex/pin')
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
      this.rethrowAsBadRequest(error, 'Failed to create Plex PIN');
    }
  }

  /**
   * Check the status of a Plex PIN
   * Returns auth token if user has authenticated
   */
  @Public()
  @Get('plex/pin/:clientId')
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
      this.rethrowAsBadRequest(error, 'Failed to check Plex PIN');
    }
  }

  /**
   * Drop a pending Plex PIN when the user abandons the sign-in
   */
  @Public()
  @Delete('plex/pin/:clientId')
  cancelPlexPin(@Param('clientId') clientId: string) {
    this.plexOAuthService.cancelPlexPin(clientId);
    return { cancelled: true };
  }

  /**
   * Complete Plex login - authenticate with auth token
   * Checks if user is admin (via linked Plex) or regular Plex user
   */
  @Public()
  @Post('plex/login')
  async plexLogin(
    @Body() body: { authToken: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!body.authToken) {
      throw new BadRequestException('Auth token is required');
    }

    try {
      // Get Plex user info
      const plexUser = await this.plexOAuthService.getPlexUserFromToken(
        body.authToken,
      );

      // Check if this Plex user is linked to an admin account
      const admin = await this.authService.findAdminByPlexUserId(
        String(plexUser.id),
      );

      if (admin) {
        // Admin user - create admin session
        const result = await this.authService.createAdminSessionByPlex(
          admin.id,
        );

        res.cookie(
          SESSION_COOKIE_NAME,
          result.session.token,
          sessionCookieOptions(req),
        );

        return {
          userType: 'admin',
          user: result.user,
          session: {
            expiresAt: result.session.expiresAt,
          },
        };
      }

      // Not an admin - verify user has access to the Plex server (by checking UserPreference)
      const hasServerAccess = await this.plexOAuthService.isPlexUserOnServer(
        String(plexUser.id),
        '', // Server token not needed - we check UserPreference table
      );

      if (!hasServerAccess) {
        throw new UnauthorizedException(
          'Your Plex account does not have access to this server.',
        );
      }

      // Check if user portal is enabled - if not, only admins can log in with Plex
      const portalEnabled = await this.configService.getSetting(
        'USER_PORTAL_ENABLED',
      );
      if (portalEnabled !== true) {
        throw new UnauthorizedException(
          'The user portal is currently disabled. Please contact your administrator.',
        );
      }

      // Create Plex user session (limited scope)
      const plexSession = await this.authService.createPlexUserSession({
        plexUserId: String(plexUser.id),
        plexUsername: plexUser.username,
        plexThumb: plexUser.thumb,
      });

      res.cookie(
        SESSION_COOKIE_NAME,
        plexSession.token,
        sessionCookieOptions(req),
      );

      return {
        userType: 'plex_user',
        user: {
          plexUserId: plexSession.plexUserId,
          plexUsername: plexSession.plexUsername,
          plexThumb: plexSession.plexThumb,
        },
        session: {
          expiresAt: plexSession.expiresAt,
        },
      };
    } catch (error) {
      this.rethrowAsBadRequest(error, 'Failed to complete Plex login');
    }
  }

  /**
   * Link Plex account to admin (authenticated admin only)
   */
  @AdminOnly()
  @Post('plex/link')
  async linkPlexAccount(
    @CurrentUser() user: AdminUser,
    @Body() body: { authToken: string },
  ) {
    if (!body.authToken) {
      throw new BadRequestException('Plex auth token is required');
    }

    try {
      // Get Plex user info first
      const plexUser = await this.plexOAuthService.getPlexUserFromToken(
        body.authToken,
      );

      const result = await this.plexOAuthService.linkPlexAccountToAdmin(
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
      this.rethrowAsBadRequest(error, 'Failed to link Plex account');
    }
  }

  /**
   * Unlink Plex account from admin (authenticated admin only)
   */
  @AdminOnly()
  @Delete('plex/link')
  async unlinkPlexAccount(@CurrentUser() user: AdminUser) {
    try {
      await this.plexOAuthService.unlinkPlexAccountFromAdmin(user.id);
      return { success: true };
    } catch (error) {
      this.rethrowAsBadRequest(error, 'Failed to unlink Plex account');
    }
  }

  /**
   * Get admin's linked Plex account info
   */
  @AdminOnly()
  @Get('plex/link')
  async getLinkedPlexAccount(@CurrentUser() user: AdminUser) {
    // User already has Plex fields from the session
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
