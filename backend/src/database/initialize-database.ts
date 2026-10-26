import { Logger } from '@nestjs/common';
import { existsSync, promises as fs } from 'fs';
import { DataSource, DataSourceOptions, MigrationInterface } from 'typeorm';
import { databaseOptions, databasePath } from '@/database/database.options';

const logger = new Logger('Database');

export const preMigrationBackupPath = (database: string): string =>
  `${database}.pre-migration`;

async function column(
  dataSource: DataSource,
  sql: string,
  parameters: string[] = [],
): Promise<string[]> {
  const rows: unknown = await dataSource.query(sql, parameters);
  return Array.isArray(rows)
    ? (rows as { value: string }[]).map((row) => row.value)
    : [];
}

async function executedMigrations(
  dataSource: DataSource,
  schema: string,
): Promise<string[]> {
  const table = dataSource.options.migrationsTableName ?? 'migrations';
  const tracked = await column(
    dataSource,
    `SELECT name AS value FROM "${schema}".sqlite_master WHERE type = 'table' AND name = ?`,
    [table],
  );
  if (tracked.length === 0) return [];
  return (
    await column(dataSource, `SELECT name AS value FROM "${schema}"."${table}"`)
  ).sort();
}

async function backupExecutedMigrations(
  dataSource: DataSource,
  backup: string,
): Promise<string[] | undefined> {
  if (!existsSync(backup)) return undefined;
  let attached = false;
  try {
    await dataSource.query(`ATTACH DATABASE ? AS "backup"`, [backup]);
    attached = true;
    return await executedMigrations(dataSource, 'backup');
  } catch {
    return undefined;
  } finally {
    if (attached) await dataSource.query(`DETACH DATABASE "backup"`);
  }
}

const migrationName = (migration: MigrationInterface): string =>
  migration.name ?? migration.constructor.name;

export async function backupBeforeMigrations(
  dataSource: DataSource,
): Promise<string | undefined> {
  const database = String(dataSource.options.database);
  const tables = await column(
    dataSource,
    `SELECT name AS value FROM sqlite_master WHERE type = 'table'`,
  );
  if (tables.length === 0) return undefined;

  const executed = await executedMigrations(dataSource, 'main');
  if (dataSource.migrations.every((m) => executed.includes(migrationName(m)))) {
    return undefined;
  }

  const backup = preMigrationBackupPath(database);
  const previous = await backupExecutedMigrations(dataSource, backup);
  if (previous?.join() === executed.join()) {
    logger.log(`Keeping ${backup}, taken before these migrations`);
    return backup;
  }

  const temporary = `${backup}.tmp`;
  try {
    await fs.rm(temporary, { force: true });
    await dataSource.query('VACUUM INTO ?', [temporary]);
    await fs.rename(temporary, backup);
  } finally {
    await fs.rm(temporary, { force: true });
  }
  logger.log(`Copied the database to ${backup} before running migrations`);
  return backup;
}

export async function initializeDatabase(
  options: DataSourceOptions = databaseOptions(databasePath()),
): Promise<DataSource> {
  const dataSource = await new DataSource({
    ...options,
    migrationsRun: false,
  }).initialize();
  try {
    await backupBeforeMigrations(dataSource);
    await dataSource.runMigrations({
      transaction: options.migrationsTransactionMode,
    });
    return dataSource;
  } catch (error) {
    await dataSource.destroy();
    throw error;
  }
}
