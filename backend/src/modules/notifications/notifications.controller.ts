import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { NotificationsService } from './services/notifications.service';
import type { CreateNotificationDto } from './services/notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getAllNotifications() {
    return await this.notificationsService.getAllNotifications();
  }

  @Get('user/:userId')
  async getNotificationsForUser(@Param('userId') userId: string) {
    return await this.notificationsService.getNotificationsForUser(userId);
  }

  @Get('user/:userId/unread-count')
  async getUnreadCount(@Param('userId') userId: string) {
    const count = await this.notificationsService.getUnreadCountForUser(userId);
    return { unreadCount: count };
  }

  @Post()
  async createNotification(@Body() createDto: CreateNotificationDto) {
    return await this.notificationsService.createNotification(createDto);
  }

  @Patch(':id/read')
  async markAsRead(@Param('id') id: number) {
    return await this.notificationsService.markAsRead(id);
  }

  @Patch('user/:userId/mark-all-read')
  async markAllAsReadForUser(@Param('userId') userId: string) {
    await this.notificationsService.markAllAsReadForUser(userId);
    return { message: 'All notifications marked as read' };
  }

  @Delete(':id')
  async deleteNotification(@Param('id') id: number) {
    await this.notificationsService.deleteNotification(id);
    return { message: 'Notification deleted successfully' };
  }

  @Delete('user/:userId/clear-all')
  async clearAllForUser(@Param('userId') userId: string) {
    await this.notificationsService.clearAllForUser(userId);
    return { message: 'All notifications cleared for user' };
  }

  @Patch('mark-all-read')
  async markAllAsRead() {
    await this.notificationsService.markAllAsRead();
    return { message: 'All notifications marked as read' };
  }

  @Delete('clear-all')
  async clearAll() {
    await this.notificationsService.clearAll();
    return { message: 'All notifications cleared' };
  }
}