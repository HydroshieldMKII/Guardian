import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { AdminUser } from '@/entities/admin-user.entity';
import { Session } from '@/entities/session.entity';
import { UserPreference } from '@/entities/user-preference.entity';
import { PasswordResetToken } from '@/entities/password-reset-token.entity';
import { AuthService } from '@/modules/auth/auth.service';
import { AuthSessionService } from '@/modules/auth/auth-session.service';
import { CaptchaService } from '@/modules/auth/captcha.service';
import { PlexOAuthService } from '@/modules/auth/plex-oauth.service';
import { PasswordResetService } from '@/modules/auth/password-reset.service';
import { AuthController } from '@/modules/auth/auth.controller';
import { PasswordResetController } from '@/modules/auth/password-reset.controller';
import { PlexAuthController } from '@/modules/auth/plex-auth.controller';
import { PlexLoginService } from '@/modules/auth/plex-login.service';
import { AuthGuard } from '@/modules/auth/guards/auth.guard';
import { ConfigModule } from '@/modules/config/config.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdminUser,
      Session,
      UserPreference,
      PasswordResetToken,
    ]),
    ConfigModule,
  ],
  providers: [
    AuthService,
    AuthSessionService,
    CaptchaService,
    PlexOAuthService,
    PasswordResetService,
    PlexLoginService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  controllers: [AuthController, PasswordResetController, PlexAuthController],
  exports: [
    AuthService,
    AuthSessionService,
    PlexOAuthService,
    PasswordResetService,
  ],
})
export class AuthModule {}
