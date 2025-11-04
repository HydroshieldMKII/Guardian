import { MigrationInterface, QueryRunner } from 'typeorm';

export class RemoveOldSmtpSetting1729870958000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('app_settings');
    if (tableExists) {
      await queryRunner.query(
        `DELETE FROM app_settings WHERE key = 'SMTP_NOTIFY_ON_NOTIFICATIONS'`,
      );
    }
  }

  public async down(): Promise<void> {}
}
