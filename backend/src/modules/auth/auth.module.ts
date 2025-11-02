import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import { AdminUser } from '../../entities/admin-user.entity';
import { Session } from '../../entities/session.entity';
import { AppSettings } from '../../entities/app-settings.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './guards/auth.guard';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([AdminUser, Session, AppSettings])],
  providers: [
    AuthService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
