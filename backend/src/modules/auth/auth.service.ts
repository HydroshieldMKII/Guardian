import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AdminUser } from '@/entities/admin-user.entity';
import { Session, SessionUserType } from '@/entities/session.entity';
import { AppSettings } from '@/entities/app-settings.entity';
import { CreateAdminDto } from '@/modules/auth/dto/create-admin.dto';
import { LoginDto } from '@/modules/auth/dto/login.dto';
import { AuthResponseDto } from '@/modules/auth/dto/session.dto';
import { UpdateProfileDto } from '@/modules/auth/dto/update-profile.dto';
import { UpdatePasswordDto } from '@/modules/auth/dto/update-password.dto';
import { SESSION_DURATION_MS } from '@/modules/auth/session-cookie';
import { SessionUser } from '@/modules/auth/session-user.types';

const ACTIVITY_REFRESH_MS = 5 * 60 * 1000;

const newSessionCredentials = () => ({
  token: crypto.randomBytes(32).toString('hex'),
  expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
  lastActivityAt: new Date(),
});

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AdminUser)
    private adminUserRepository: Repository<AdminUser>,
    @InjectRepository(Session)
    private sessionRepository: Repository<Session>,
    @InjectRepository(AppSettings)
    private appSettingsRepository: Repository<AppSettings>,
  ) {}

  /**
   * Check if any admin user exists
   */
  async hasAdminUsers(): Promise<boolean> {
    const count = await this.adminUserRepository.count();
    return count > 0;
  }

  /**
   * Create initial admin user
   */
  async createAdmin(dto: CreateAdminDto): Promise<AuthResponseDto> {
    // Validate no admin exists
    const adminExists = await this.hasAdminUsers();
    if (adminExists) {
      throw new BadRequestException('Admin user already exists');
    }

    // Validate passwords match
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      const admin = await this.adminUserRepository.manager.transaction(
        async (manager) => {
          const repository = manager.getRepository(AdminUser);
          if ((await repository.count()) > 0) {
            throw new BadRequestException('Admin user already exists');
          }
          return repository.save({
            username: dto.username,
            email: dto.email,
            passwordHash,
          });
        },
      );

      // Create session
      const session = await this.createSession(admin.id);

      return {
        user: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          avatarUrl: admin.avatarUrl,
        },
        session,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const dbError = error as { code?: string };
      if (dbError.code === 'SQLITE_CONSTRAINT') {
        throw new BadRequestException('Username or email already exists');
      }
      throw new InternalServerErrorException('Failed to create admin user');
    }
  }

  /**
   * Login with username/email and password
   */
  async login(dto: LoginDto): Promise<AuthResponseDto> {
    // Validate Cloudflare Turnstile captcha if enabled
    await this.validateCaptcha(dto.captchaToken);

    // Find admin by username or email
    const admin = await this.adminUserRepository.findOne({
      where: [{ username: dto.username }, { email: dto.username }],
    });

    if (!admin) {
      // Don't reveal if user exists
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const passwordValid = await bcrypt.compare(
      dto.password,
      admin.passwordHash,
    );

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Create session
    const session = await this.createSession(admin.id);

    return {
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        avatarUrl: admin.avatarUrl,
      },
      session,
    };
  }

  /**
   * Validate Cloudflare Turnstile captcha token
   */
  private async validateCaptcha(token?: string): Promise<void> {
    // Get Cloudflare Turnstile secret key from settings
    const secretKeySetting = await this.appSettingsRepository.findOne({
      where: { key: 'CLOUDFLARE_TURNSTILE_SECRET_KEY' },
    });

    const secretKey = secretKeySetting?.value?.trim();

    // If no secret key is configured, captcha is disabled
    if (!secretKey) {
      return;
    }

    // If captcha is enabled but no token provided
    if (!token) {
      throw new UnauthorizedException('Captcha validation required');
    }

    try {
      const response = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            secret: secretKey,
            response: token,
          }),
        },
      );

      const data = (await response.json()) as { success: boolean };

      if (!data.success) {
        throw new UnauthorizedException('Captcha validation failed');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Failed to verify captcha');
    }
  }

  /**
   * Create a new session for a user
   */
  private async createSession(userId: string): Promise<{
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    createdAt: Date;
  }> {
    const session = await this.sessionRepository.save({
      ...newSessionCredentials(),
      userId,
      userType: 'admin',
    });

    return {
      id: session.id,
      userId: session.userId,
      token: session.token,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
    };
  }

  /**
   * Create a session for a Plex user (non-admin)
   */
  async createPlexUserSession(plexUserInfo: {
    plexUserId: string;
    plexUsername: string;
    plexThumb?: string;
  }): Promise<{
    token: string;
    expiresAt: Date;
    userType: SessionUserType;
    plexUserId: string;
    plexUsername: string;
    plexThumb?: string;
  }> {
    const session = await this.sessionRepository.save({
      ...newSessionCredentials(),
      userId: null,
      userType: 'plex_user',
      plexUserId: plexUserInfo.plexUserId,
      plexUsername: plexUserInfo.plexUsername,
      plexThumb: plexUserInfo.plexThumb || null,
    });

    return {
      token: session.token,
      expiresAt: session.expiresAt,
      userType: session.userType,
      plexUserId: session.plexUserId,
      plexUsername: session.plexUsername,
      plexThumb: session.plexThumb || undefined,
    };
  }

  /**
   * Validate and retrieve session - supports both admin and Plex user sessions
   */
  async validateSession(token: string): Promise<SessionUser | null> {
    try {
      // Find session
      const session = await this.sessionRepository.findOne({
        where: { token },
        relations: ['user'],
      });

      if (!session) {
        return null;
      }

      // Check if expired
      if (new Date() > session.expiresAt) {
        await this.sessionRepository.remove(session);
        return null;
      }

      const now = new Date();
      const lastActivity = session.lastActivityAt?.getTime() ?? 0;
      if (now.getTime() - lastActivity > ACTIVITY_REFRESH_MS) {
        session.lastActivityAt = now;
        await this.sessionRepository.save(session);
      }

      // Return appropriate user data based on session type
      if (session.userType === 'plex_user') {
        if (!session.plexUserId || !session.plexUsername) {
          return null;
        }
        return {
          sessionId: session.id,
          userType: 'plex_user',
          plexUserId: session.plexUserId,
          plexUsername: session.plexUsername,
          plexThumb: session.plexThumb || undefined,
        };
      }

      // Admin session
      if (!session.user) {
        return null;
      }

      return {
        ...session.user,
        sessionId: session.id,
        userType: 'admin',
      };
    } catch {
      return null;
    }
  }

  /**
   * Logout
   */
  async logout(token: string): Promise<void> {
    await this.sessionRepository.delete({ token });
  }

  /**
   * Clean up expired sessions (run via cron)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.sessionRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    return result.affected || 0;
  }

  /**
   * Revoke all Plex user sessions (non-admin sessions)
   * Called when the user portal is disabled
   */
  async revokeAllPlexUserSessions(): Promise<number> {
    const result = await this.sessionRepository.delete({
      userType: 'plex_user',
    });

    return result.affected || 0;
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<{
    id: string;
    username: string;
    email: string;
    avatarUrl?: string | null;
  }> {
    const user = await this.adminUserRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Check if new username is already taken
    if (dto.username && dto.username !== user.username) {
      const existingUser = await this.adminUserRepository.findOne({
        where: { username: dto.username },
      });
      if (existingUser) {
        throw new BadRequestException('Username already exists');
      }
    }

    // Check if new email is already taken
    if (dto.email && dto.email !== user.email) {
      const existingUser = await this.adminUserRepository.findOne({
        where: { email: dto.email },
      });
      if (existingUser) {
        throw new BadRequestException('Email already exists');
      }
    }

    try {
      if (dto.username) {
        user.username = dto.username;
      }
      if (dto.email !== undefined) {
        user.email = dto.email;
      }
      if (dto.avatarUrl !== undefined) {
        user.avatarUrl = dto.avatarUrl;
      }

      await this.adminUserRepository.save(user);

      return {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
      };
    } catch {
      throw new InternalServerErrorException('Failed to update profile');
    }
  }

  /**
   * Update user password
   */
  async updatePassword(
    userId: string,
    dto: UpdatePasswordDto,
    currentSessionId?: string,
  ): Promise<void> {
    const user = await this.adminUserRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify current password
    const passwordValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!passwordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Validate new passwords match
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('New passwords do not match');
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(dto.newPassword, 12);

    try {
      user.passwordHash = newPasswordHash;
      await this.adminUserRepository.save(user);

      // Clear all sessions except current one if requested
      if (dto.clearSessions) {
        await this.clearAllSessions(userId, currentSessionId);
      }
    } catch {
      throw new InternalServerErrorException('Failed to update password');
    }
  }

  /**
   * Clear all sessions for a user except optionally the current session
   */
  async clearAllSessions(
    userId: string,
    currentSessionId?: string,
  ): Promise<void> {
    try {
      if (currentSessionId) {
        // Delete all sessions except the current one
        await this.sessionRepository
          .createQueryBuilder()
          .delete()
          .where('userId = :userId AND id != :currentSessionId', {
            userId,
            currentSessionId,
          })
          .execute();
      } else {
        await this.sessionRepository.delete({ userId });
      }
    } catch {
      throw new InternalServerErrorException('Failed to clear sessions');
    }
  }

  /**
   * Clear all Plex user sessions by Plex user ID
   */
  async clearPlexUserSessions(plexUserId: string): Promise<void> {
    try {
      await this.sessionRepository.delete({
        userType: 'plex_user',
        plexUserId,
      });
    } catch {
      throw new InternalServerErrorException(
        'Failed to clear Plex user sessions',
      );
    }
  }

  /**
   * Validate user's current password for admin operations
   */
  async validatePassword(userId: string, password: string): Promise<boolean> {
    const user = await this.adminUserRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    return passwordValid;
  }

  /**
   * Find admin user by linked Plex user ID
   */
  async findAdminByPlexUserId(plexUserId: string): Promise<AdminUser | null> {
    return this.adminUserRepository.findOne({
      where: { plexUserId },
    });
  }

  /**
   * Create admin session by Plex login (for linked accounts)
   */
  async createAdminSessionByPlex(adminId: string): Promise<AuthResponseDto> {
    const admin = await this.adminUserRepository.findOne({
      where: { id: adminId },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    const session = await this.createSession(admin.id);

    return {
      user: {
        id: admin.id,
        username: admin.username,
        email: admin.email,
        avatarUrl: admin.avatarUrl,
      },
      session,
    };
  }
}
