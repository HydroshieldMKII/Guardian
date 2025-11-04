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
import { AdminUser } from '../../entities/admin-user.entity';
import { Session } from '../../entities/session.entity';
import { AppSettings } from '../../entities/app-settings.entity';
import { CreateAdminDto } from './dto/create-admin.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/session.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';

// Session expiration: 7 days in ms
const SESSION_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;

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
      // Create admin user
      const admin = await this.adminUserRepository.save({
        username: dto.username,
        email: dto.email,
        passwordHash,
      });

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
   * Create a new session for a user
   */
  private async createSession(userId: string): Promise<{
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    createdAt: Date;
  }> {
    // Generate secure token (32 bytes/256 bits)
    const token = crypto.randomBytes(32).toString('hex');

    // Set expiration
    const expiresAt = new Date(Date.now() + SESSION_EXPIRATION_MS);

    // Store session
    const session = await this.sessionRepository.save({
      token,
      userId,
      expiresAt,
      lastActivityAt: new Date(),
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
   * Validate and retrieve session
   */
  async validateSession(
    token: string,
  ): Promise<(AdminUser & { sessionId: string }) | null> {
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

      // Update last activity
      session.lastActivityAt = new Date();
      await this.sessionRepository.save(session);

      return {
        ...session.user,
        sessionId: session.id,
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
   * Update user profile
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<{
    id: string;
    username: string;
    email: string;
    avatarUrl?: string;
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
}
