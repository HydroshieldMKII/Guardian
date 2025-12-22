import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { AdminUser } from '../../entities/admin-user.entity';
import { Session } from '../../entities/session.entity';
import { AppSettings } from '../../entities/app-settings.entity';
import { UserPreference } from '../../entities/user-preference.entity';
import { AuthService } from './auth.service';
import { PlexOAuthService } from './plex-oauth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './guards/auth.guard';
import { ConfigModule } from '../config/config.module';

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
