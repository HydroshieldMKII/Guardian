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
import { AuthService } from './auth.service';
import { PlexOAuthService } from './plex-oauth.service';
import { ConfigService } from '../config/services/config.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { AdminOnly } from './decorators/admin-only.decorator';
import { AdminUser } from '../../entities/admin-user.entity';

// 7 days
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const getCookieOptions = () => {
  return {
    httpOnly: true,
    secure: false,
    sameSite: 'lax' as 'strict' | 'lax' | 'none',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  };
};

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private plexOAuthService: PlexOAuthService,
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
   * Create initial admin account
   * Only accessible if no admin exists
   */
  @Public()
  @Post('create-admin')
  async createAdmin(
    @Body() dto: CreateAdminDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Validate no admin exists
    const adminExists = await this.authService.hasAdminUsers();
    if (adminExists) {
      throw new BadRequestException('Admin user already exists');
    }

    // Validate passwords match
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const result = await this.authService.createAdmin(dto);

    // Set session cookie
    res.cookie('session_token', result.session.token, getCookieOptions());

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
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto);

    // Set session cookie
    res.cookie('session_token', result.session.token, getCookieOptions());

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
    const token = this.extractToken(req);

    if (token) {
      await this.authService.logout(token);
    }

    // Clear cookie
    res.clearCookie('session_token', getCookieOptions());

    return { success: true };
  }

  /**
   * Get current user
   */
  @Get('me')
  getCurrentUser(
    @CurrentUser()
    user:
      | AdminUser
      | {
          userType: 'plex_user';
          plexUserId: string;
          plexUsername: string;
          plexThumb?: string;
        },
  ) {
    if (!user) {
      throw new BadRequestException('Not authenticated');
    }

    // Check if this is a Plex user session
    if ('userType' in user && user.userType === 'plex_user') {
      return {
        plexUserId: user.plexUserId,
        plexUsername: user.plexUsername,
        plexThumb: user.plexThumb,
      };
    }

    // Admin user
    const adminUser = user as AdminUser;
    return {
      id: adminUser.id,
      username: adminUser.username,
      email: adminUser.email,
      avatarUrl: adminUser.avatarUrl,
      plexUserId: adminUser.plexUserId,
      plexUsername: adminUser.plexUsername,
      plexEmail: adminUser.plexEmail,
      plexThumb: adminUser.plexThumb,
    };
  }

  /**
   * Update user profile
   */
  @Patch('profile')
  async updateProfile(
    @CurrentUser() user: AdminUser,
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
  @Patch('password')
  async updatePassword(
    @CurrentUser() user: AdminUser & { sessionId?: string },
    @Body() dto: UpdatePasswordDto,
  ) {
    if (!user) {
      throw new BadRequestException('Not authenticated');
    }

    await this.authService.updatePassword(user.id, dto, user.sessionId);
    return { success: true };
  }

  /**
   * Helper to extract token from cookies or headers
   */
  private extractToken(req: Request): string | null {
    // Try cookie first (preferred, httpOnly)
    if (req.cookies && req.cookies.session_token) {
      return req.cookies.session_token;
    }

    return null;
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
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to create Plex PIN',
      );
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
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to check Plex PIN',
      );
    }
  }

  /**
   * Complete Plex login - authenticate with auth token
   * Checks if user is admin (via linked Plex) or regular Plex user
   */
  @Public()
  @Post('plex/login')
  async plexLogin(
    @Body() body: { authToken: string },
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

        res.cookie('session_token', result.session.token, getCookieOptions());

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

      res.cookie('session_token', plexSession.token, getCookieOptions());

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
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Failed to complete Plex login',
      );
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
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Failed to link Plex account',
      );
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
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Failed to unlink Plex account',
      );
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
