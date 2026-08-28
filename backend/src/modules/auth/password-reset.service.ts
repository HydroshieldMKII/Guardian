import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AdminUser } from '@/entities/admin-user.entity';
import { PasswordResetToken } from '@/entities/password-reset-token.entity';
import { ConfigService } from '@/modules/config/services/config.service';
import { EmailService } from '@/modules/config/services/email.service';
import { AuthService } from '@/modules/auth/auth.service';
import { ConfirmPasswordResetDto } from '@/modules/auth/dto/password-reset.dto';
import { appUrl } from '@/config/app.config';

export const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;

const TOKEN_BYTES = 48;

const hashToken = (token: string) =>
  crypto.createHash('sha256').update(token).digest('hex');

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    @InjectRepository(AdminUser)
    private readonly adminUserRepository: Repository<AdminUser>,
    @InjectRepository(PasswordResetToken)
    private readonly tokenRepository: Repository<PasswordResetToken>,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly authService: AuthService,
  ) {}

  async getStatus(): Promise<{
    enabled: boolean;
    emailConfigured: boolean;
    appUrlConfigured: boolean;
    adminEmailConfigured: boolean;
  }> {
    const [toggled, smtp, addressableAdmins] = await Promise.all([
      this.configService.getSetting('PASSWORD_RESET_ENABLED'),
      this.emailService.loadSmtpSettings(),
      this.adminUserRepository
        .createQueryBuilder('admin')
        .where("TRIM(COALESCE(admin.email, '')) <> ''")
        .getCount(),
    ]);

    const emailConfigured = Boolean(
      smtp.SMTP_ENABLED && smtp.SMTP_HOST && smtp.SMTP_FROM_EMAIL,
    );
    const appUrlConfigured = appUrl() !== null;
    const adminEmailConfigured = addressableAdmins > 0;

    return {
      enabled:
        toggled === true &&
        emailConfigured &&
        appUrlConfigured &&
        adminEmailConfigured,
      emailConfigured,
      appUrlConfigured,
      adminEmailConfigured,
    };
  }

  async requestReset(email: string): Promise<void> {
    await this.purgeExpired();

    const status = await this.getStatus();
    if (!status.enabled) {
      this.logger.warn(
        'Password reset requested while the feature is unavailable',
      );
      return;
    }

    const admin = await this.adminUserRepository
      .createQueryBuilder('admin')
      .where('LOWER(admin.email) = LOWER(:email)', { email })
      .getOne();

    if (!admin) {
      return;
    }

    const token = crypto.randomBytes(TOKEN_BYTES).toString('base64url');

    await this.tokenRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(PasswordResetToken);
      await repository.delete({ userId: admin.id });
      await repository.save({
        userId: admin.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
      });
    });

    await this.emailService.sendPasswordResetEmail(
      admin.email,
      admin.username,
      `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`,
      PASSWORD_RESET_TTL_MS / 60000,
    );
  }

  async verify(token: string): Promise<boolean> {
    return (await this.findValidToken(token)) !== null;
  }

  async confirm(dto: ConfirmPasswordResetDto): Promise<void> {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('New passwords do not match');
    }

    const stored = await this.findValidToken(dto.token);
    if (!stored) {
      throw new BadRequestException(
        'This reset link is no longer valid. Request a new one.',
      );
    }

    const admin = await this.adminUserRepository.findOne({
      where: { id: stored.userId },
    });
    if (!admin) {
      await this.tokenRepository.delete({ id: stored.id });
      throw new BadRequestException(
        'This reset link is no longer valid. Request a new one.',
      );
    }

    admin.passwordHash = await bcrypt.hash(dto.password, 12);
    await this.adminUserRepository.save(admin);
    await this.tokenRepository.delete({ id: stored.id });
    await this.authService.clearAllSessions(admin.id);
  }

  private async findValidToken(
    token: string,
  ): Promise<PasswordResetToken | null> {
    await this.purgeExpired();

    const stored = await this.tokenRepository.findOne({
      where: { tokenHash: hashToken(token) },
    });

    return stored && stored.expiresAt > new Date() ? stored : null;
  }

  private async purgeExpired(): Promise<void> {
    await this.tokenRepository.delete({ expiresAt: LessThan(new Date()) });
  }
}
