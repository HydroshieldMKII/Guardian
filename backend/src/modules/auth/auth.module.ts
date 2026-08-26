import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { AdminUser } from '@/entities/admin-user.entity';
import { Session } from '@/entities/session.entity';
import { AppSettings } from '@/entities/app-settings.entity';
import { UserPreference } from '@/entities/user-preference.entity';
import { AuthService } from '@/modules/auth/auth.service';
import { PlexOAuthService } from '@/modules/auth/plex-oauth.service';
import { AuthController } from '@/modules/auth/auth.controller';
import { AuthGuard } from '@/modules/auth/guards/auth.guard';
import { ConfigModule } from '@/modules/config/config.module';

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([AdminUser, Session, AppSettings, UserPreference]),
    ConfigModule,
  ],
  providers: [
    AuthService,
    PlexOAuthService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  controllers: [AuthController],
  exports: [AuthService, PlexOAuthService],
})
export class AuthModule {}
