import { QueryRunner } from 'typeorm';

export async function selectRows<T>(
  queryRunner: QueryRunner,
  sql: string,
  parameters: unknown[] = [],
): Promise<T[]> {
  const rows: unknown = await queryRunner.query(sql, parameters);
  return Array.isArray(rows) ? (rows as T[]) : [];
}
