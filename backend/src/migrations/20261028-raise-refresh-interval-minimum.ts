import { MigrationInterface, QueryRunner } from 'typeorm';

export class RaiseRefreshIntervalMinimum1793145600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('app_settings');
    if (tableExists) {
      await queryRunner.query(
        `UPDATE app_settings SET value = '5' WHERE key = 'PLEXGUARD_REFRESH_INTERVAL' AND (value GLOB '[0-9]*' OR value GLOB '-[0-9]*') AND CAST(value AS REAL) < 5`,
      );
    }
  }

  public async down(): Promise<void> {}
}
