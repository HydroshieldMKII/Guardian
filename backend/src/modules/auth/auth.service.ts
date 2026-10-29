import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { AdminUser } from '@/entities/admin-user.entity';
import { CreateAdminDto } from '@/modules/auth/dto/create-admin.dto';
import { LoginDto } from '@/modules/auth/dto/login.dto';
import { AuthResponseDto, UserDto } from '@/modules/auth/dto/session.dto';
import { UpdateProfileDto } from '@/modules/auth/dto/update-profile.dto';
import { UpdatePasswordDto } from '@/modules/auth/dto/update-password.dto';
import { AuthSessionService } from '@/modules/auth/auth-session.service';
import { CaptchaService } from '@/modules/auth/captcha.service';
import { serialTransaction } from '@/database/serial-transaction';

const BCRYPT_ROUNDS = 12;

const UNKNOWN_ACCOUNT_HASH =
  '$2b$12$2oRwdn1IDk13ZyAjUNtmOOCft6x.oqQjxVQPdpk8RxEnGWyiJraOK';

const toUserDto = (admin: AdminUser): UserDto => ({
  id: admin.id,
  username: admin.username,
  email: admin.email,
  avatarUrl: admin.avatarUrl,
});

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(AdminUser)
    private adminUserRepository: Repository<AdminUser>,
    private readonly authSessions: AuthSessionService,
    private readonly captcha: CaptchaService,
  ) {}

  async hasAdminUsers(): Promise<boolean> {
    const count = await this.adminUserRepository.count();
    return count > 0;
  }

  async createAdmin(dto: CreateAdminDto): Promise<AuthResponseDto> {
    if (await this.hasAdminUsers()) {
      throw new BadRequestException('Admin user already exists');
    }

    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      const admin = await serialTransaction(
        this.adminUserRepository.manager,
        async (manager) => {
          const repository = manager.getRepository(AdminUser);
          if ((await repository.count()) > 0) {
            throw new BadRequestException('Admin user already exists');
          }
          return repository.save({
            username: dto.username,
            email: dto.email ?? '',
            passwordHash,
          });
        },
      );

      return await this.signIn(admin);
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

  async login(dto: LoginDto): Promise<AuthResponseDto> {
    await this.captcha.verify(dto.captchaToken);

    const admin = await this.adminUserRepository.findOne({
      where: [{ username: dto.username }, { email: dto.username }],
    });

    const passwordValid = await bcrypt.compare(
      dto.password,
      admin?.passwordHash ?? UNKNOWN_ACCOUNT_HASH,
    );

    if (!admin || !passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.signIn(admin);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserDto> {
    const user = await this.findAdminOrFail(userId);

    if (dto.username && dto.username !== user.username) {
      const existingUser = await this.adminUserRepository.findOne({
        where: { username: dto.username },
      });
      if (existingUser) {
        throw new BadRequestException('Username already exists');
      }
    }

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
        user.email = dto.email ?? '';
      }
      if (dto.avatarUrl !== undefined) {
        user.avatarUrl = dto.avatarUrl;
      }

      await this.adminUserRepository.save(user);

      return toUserDto(user);
    } catch {
      throw new InternalServerErrorException('Failed to update profile');
    }
  }

  async updatePassword(
    userId: string,
    dto: UpdatePasswordDto,
    currentSessionId?: string,
  ): Promise<void> {
    const user = await this.findAdminOrFail(userId);

    const passwordValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!passwordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('New passwords do not match');
    }

    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }

    const newPasswordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    try {
      user.passwordHash = newPasswordHash;
      await this.adminUserRepository.save(user);

      if (dto.clearSessions) {
        await this.authSessions.clearAllSessions(userId, currentSessionId);
      }
    } catch {
      throw new InternalServerErrorException('Failed to update password');
    }
  }

  async validatePassword(userId: string, password: string): Promise<boolean> {
    const user = await this.findAdminOrFail(userId);
    return bcrypt.compare(password, user.passwordHash);
  }

  async findAdminByPlexUserId(plexUserId: string): Promise<AdminUser | null> {
    return this.adminUserRepository.findOne({
      where: { plexUserId },
    });
  }

  async createAdminSessionByPlex(adminId: string): Promise<AuthResponseDto> {
    const admin = await this.adminUserRepository.findOne({
      where: { id: adminId },
    });

    if (!admin) {
      throw new UnauthorizedException('Admin not found');
    }

    return this.signIn(admin);
  }

  private async findAdminOrFail(userId: string): Promise<AdminUser> {
    const user = await this.adminUserRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  private async signIn(admin: AdminUser): Promise<AuthResponseDto> {
    const session = await this.authSessions.createAdminSession(admin.id);
    return { user: toUserDto(admin), session };
  }
}
