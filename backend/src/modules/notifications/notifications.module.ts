import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsController } from '@/modules/notifications/notifications.controller';
import { NotificationsService } from '@/modules/notifications/services/notifications.service';
import { NotificationOrchestratorService } from '@/modules/notifications/services/notification-orchestrator.service';
import { NotificationDispatchService } from '@/modules/notifications/services/notification-dispatch.service';
import { Notification } from '@/entities/notification.entity';
import { SessionHistory } from '@/entities/session-history.entity';
import { UserPreference } from '@/entities/user-preference.entity';
import { UserDevice } from '@/entities/user-device.entity';
import { ConfigModule } from '@/modules/config/config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      SessionHistory,
      UserPreference,
      UserDevice,
    ]),
    ConfigModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationDispatchService,
    NotificationOrchestratorService,
  ],
  exports: [
    NotificationsService,
    NotificationDispatchService,
    NotificationOrchestratorService,
  ],
})
export class NotificationsModule {}
