import { MigrationInterface, QueryRunner } from 'typeorm';

type StoredAdmin = { id: string; email: string | null };

const normalized = (email: string) => email.trim().toLowerCase();

export class LowercaseAdminEmails1793232000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('admin_users'))) {
      return;
    }

    const admins = await queryRunner.manager
      .createQueryBuilder()
      .select(['admin.id AS id', 'admin.email AS email'])
      .from('admin_users', 'admin')
      .getRawMany<StoredAdmin>();
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
        await queryRunner.manager
          .createQueryBuilder()
          .update('admin_users')
          .set({ email: wanted })
          .where({ id })
          .execute();
      }
    }
  }

  public async down(): Promise<void> {}
}
