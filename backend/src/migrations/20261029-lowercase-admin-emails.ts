import { MigrationInterface, QueryRunner } from 'typeorm';
import { selectRows } from '@/database/migration-rows';

type StoredAdmin = { id: string; email: string | null };

const normalized = (email: string) => email.trim().toLowerCase();

export class LowercaseAdminEmails1793232000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('admin_users'))) {
      return;
    }

    const admins = await selectRows<StoredAdmin>(
      queryRunner,
      `SELECT id, email FROM admin_users`,
    );
    const owners = new Map<string, number>();
    for (const { email } of admins) {
      if (email !== null) {
        owners.set(normalized(email), (owners.get(normalized(email)) ?? 0) + 1);
      }
    }

    for (const { id, email } of admins) {
      if (email === null) {
        continue;
      }
      const wanted = normalized(email);
      if (wanted !== email && owners.get(wanted) === 1) {
        await queryRunner.query(
          `UPDATE admin_users SET email = ? WHERE id = ?`,
          [wanted, id],
        );
      }
    }
  }

  public async down(): Promise<void> {}
}
