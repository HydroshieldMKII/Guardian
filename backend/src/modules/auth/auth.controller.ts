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
import type { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { CreateAdminDto } from './dto/create-admin.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';

// 7 days
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

const getCookieOptions = () => {
  return {
    httpOnly: true,
    secure: true,
    sameSite: (process.env.NODE_ENV === 'production' ? 'strict' : 'none') as
      | 'strict'
      | 'lax'
      | 'none',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  };
};

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

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
  async getCurrentUser(@CurrentUser() user: any) {
    if (!user) {
      throw new BadRequestException('Not authenticated');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
    };
  }

  /**
   * Update user profile
   */
  @Patch('profile')
  async updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
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
    @CurrentUser() user: any,
    @Body() dto: UpdatePasswordDto,
  ) {
    if (!user) {
      throw new BadRequestException('Not authenticated');
    }

    await this.authService.updatePassword(user.id, dto);
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
}
