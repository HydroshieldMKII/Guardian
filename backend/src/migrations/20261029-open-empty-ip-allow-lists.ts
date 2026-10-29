import { MigrationInterface, QueryRunner } from 'typeorm';
import { selectRows } from '@/database/migration-rows';

type StoredPreference = {
  id: number;
  ipAccessPolicy: string;
  allowedIPs: string | null;
};

const readAllowList = (stored: string | null): unknown => {
  if (stored === null) {
    return [];
  }
  try {
    return JSON.parse(stored);
  } catch {
    return undefined;
  }
};

export class OpenEmptyIpAllowLists1793235600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user_preferences'))) {
      return;
    }

    const preferences = await selectRows<StoredPreference>(
      queryRunner,
      `SELECT id, ip_access_policy AS ipAccessPolicy, allowed_ips AS allowedIPs FROM user_preferences`,
    );

    for (const { id, ipAccessPolicy, allowedIPs } of preferences) {
      const allowList = readAllowList(allowedIPs);
      const unreadable = allowList === undefined;
      const empty =
        unreadable || (Array.isArray(allowList) && allowList.length === 0);
      if (unreadable) {
        await queryRunner.query(
          `UPDATE user_preferences SET allowed_ips = NULL WHERE id = ?`,
          [id],
        );
      }
      if (ipAccessPolicy === 'restricted' && empty) {
        await queryRunner.query(
          `UPDATE user_preferences SET ip_access_policy = 'all' WHERE id = ?`,
          [id],
        );
      }
    }
  }

  public async down(): Promise<void> {}
}
