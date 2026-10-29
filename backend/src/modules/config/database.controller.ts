import {
  Controller,
  Get,
  Body,
  Post,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { DatabaseMaintenanceService } from '@/modules/config/services/database-maintenance.service';
import { DatabaseService } from '@/modules/config/services/database.service';
import { AuthService } from '@/modules/auth/auth.service';
import { ConfirmPasswordDto } from '@/modules/auth/dto/confirm-password.dto';
import { CurrentUser } from '@/modules/auth/decorators/current-user.decorator';
import { AdminOnly } from '@/modules/auth/decorators/admin-only.decorator';
import type { AdminSessionUser } from '@/modules/auth/session-user.types';
import { respondOrFail } from '@/common/utils/respond-or-fail';

const MAX_IMPORT_FILE_BYTES = 8 * 1024 * 1024;

interface UploadedDatabaseFile {
  buffer: Buffer;
}

const parseUpload = (file: UploadedDatabaseFile | undefined): unknown => {
  if (!file) {
    throw new HttpException('No file provided', HttpStatus.BAD_REQUEST);
  }
  try {
    return JSON.parse(file.buffer.toString('utf8'));
  } catch {
    throw new HttpException('Invalid JSON file', HttpStatus.BAD_REQUEST);
  }
};

const backupFilename = (now: Date): string =>
  `guardian-backup-${now.toISOString().replace(/[:.]/g, '-')}.json`;

@Controller('config')
@AdminOnly()
export class DatabaseController {
  constructor(
    private readonly databaseMaintenance: DatabaseMaintenanceService,
    private readonly databaseService: DatabaseService,
    private readonly authService: AuthService,
  ) {}

  @Get('database/export')
  exportDatabase(@Res() res: Response) {
    return respondOrFail(async () => {
      const exportData = await this.databaseMaintenance.exportDatabase();
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${backupFilename(new Date())}"`,
      );
      res.send(exportData);
    }, 'Failed to export database');
  }

  @Post('database/import')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_IMPORT_FILE_BYTES } }),
  )
  importDatabase(@UploadedFile() file: UploadedDatabaseFile | undefined) {
    return respondOrFail(
      async () => ({
        message: 'Database imported successfully',
        imported: await this.databaseMaintenance.importDatabase(
          parseUpload(file),
        ),
      }),
      'Failed to import database',
      { exposeCause: true },
    );
  }

  @Post('scripts/reset-database')
  resetDatabase(
    @Body() dto: ConfirmPasswordDto,
    @CurrentUser() user: AdminSessionUser,
  ) {
    return this.runScript(
      user,
      dto,
      () => this.databaseMaintenance.resetDatabase(),
      'Database reset successfully',
      'Failed to reset database',
    );
  }

  @Post('scripts/reset-stream-counts')
  resetStreamCounts(
    @Body() dto: ConfirmPasswordDto,
    @CurrentUser() user: AdminSessionUser,
  ) {
    return this.runScript(
      user,
      dto,
      () => this.databaseService.resetStreamCounts(),
      'Stream counts reset successfully',
      'Failed to reset stream counts',
    );
  }

  @Post('scripts/delete-all-devices')
  deleteAllDevices(
    @Body() dto: ConfirmPasswordDto,
    @CurrentUser() user: AdminSessionUser,
  ) {
    return this.runScript(
      user,
      dto,
      () => this.databaseService.deleteAllDevices(),
      'All devices deleted successfully',
      'Failed to delete all devices',
    );
  }

  @Post('scripts/clear-session-history')
  clearSessionHistory(
    @Body() dto: ConfirmPasswordDto,
    @CurrentUser() user: AdminSessionUser,
  ) {
    return this.runScript(
      user,
      dto,
      () => this.databaseService.clearAllSessionHistory(),
      'Session history cleared successfully',
      'Failed to clear session history',
    );
  }

  private runScript(
    user: AdminSessionUser,
    { password }: ConfirmPasswordDto,
    script: () => Promise<void>,
    message: string,
    fallback: string,
  ): Promise<{ message: string }> {
    return respondOrFail(
      async () => {
        if (!(await this.authService.validatePassword(user.id, password))) {
          throw new ForbiddenException('Invalid password');
        }
        await script();
        return { message };
      },
      fallback,
      { exposeCause: true },
    );
  }
}
