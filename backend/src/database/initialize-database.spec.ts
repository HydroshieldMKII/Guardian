import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource, MigrationInterface } from 'typeorm';
import { databaseOptions } from '@/database/database.options';
import {
  initializeDatabase,
  preMigrationBackupPath,
} from '@/database/initialize-database';

class FailingMigration9999999999999 implements MigrationInterface {
  name = 'FailingMigration9999999999999';

  async up(): Promise<void> {
    throw new Error('migration failed');
  }

  async down(): Promise<void> {}
}

describe('initializeDatabase', () => {
  let workDir: string;
  let database: string;
  let backup: string;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-init-'));
    database = path.join(workDir, 'guardian.db');
    backup = preMigrationBackupPath(database);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  const raw = async <T>(
    file: string,
    run: (dataSource: DataSource) => Promise<T>,
  ): Promise<T> => {
    const dataSource = await new DataSource({
      type: 'sqlite',
      database: file,
    }).initialize();
    try {
      return await run(dataSource);
    } finally {
      await dataSource.destroy();
    }
  };

  const createLegacyDatabase = () =>
    raw(database, async (dataSource) => {
      await dataSource.query(
        `CREATE TABLE "app_settings" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "key" varchar NOT NULL, "value" text NOT NULL)`,
      );
      await addSetting('PLEX_SERVER_IP');
    });

  const addSetting = (key: string) =>
    raw(database, (dataSource) =>
      dataSource.query(
        `INSERT INTO app_settings (key, value) VALUES (?, 'value')`,
        [key],
      ),
    );

  const settingsIn = (file: string): Promise<string[]> =>
    raw(file, async (dataSource) => {
      const rows: { key: string }[] = await dataSource.query(
        'SELECT key FROM app_settings ORDER BY key',
      );
      return rows.map((row) => row.key);
    });

  const tablesIn = (file: string): Promise<string[]> =>
    raw(file, async (dataSource) => {
      const rows: { name: string }[] = await dataSource.query(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
      );
      return rows.map((row) => row.name);
    });

  const leftovers = () =>
    fs.readdirSync(workDir).filter((file) => file.endsWith('.tmp'));

  const start = async (options = databaseOptions(database)) => {
    await (await initializeDatabase(options)).destroy();
  };

  const startWithFailingMigration = () =>
    start({
      ...databaseOptions(database),
      migrations: [
        ...(databaseOptions(database).migrations as string[]),
        FailingMigration9999999999999,
      ],
    });

  it('creates a new database without a backup', async () => {
    await start();

    expect(fs.existsSync(backup)).toBe(false);
    expect(await tablesIn(database)).toContain('app_settings');
  });

  it('backs up an existing database before migrating it', async () => {
    await createLegacyDatabase();

    await start();

    expect(await tablesIn(backup)).toEqual(['app_settings']);
    expect(await settingsIn(backup)).toEqual(['PLEX_SERVER_IP']);
    expect(await tablesIn(database)).toContain('migrations');
    expect(await settingsIn(database)).toEqual(['PLEX_SERVER_IP']);
    expect(leftovers()).toEqual([]);
  });

  it('leaves the backup alone when nothing is pending', async () => {
    await createLegacyDatabase();
    await start();
    const taken = fs.readFileSync(backup);
    await addSetting('APP_URL');

    await start();

    expect(fs.readFileSync(backup)).toEqual(taken);
  });

  it('keeps the pre-upgrade backup when a migration fails and is retried', async () => {
    await createLegacyDatabase();
    await start();
    await addSetting('APP_URL');

    await expect(startWithFailingMigration()).rejects.toThrow(
      'migration failed',
    );
    await addSetting('SMTP_HOST');
    await expect(startWithFailingMigration()).rejects.toThrow(
      'migration failed',
    );

    expect(await settingsIn(backup)).toEqual(['APP_URL', 'PLEX_SERVER_IP']);
    expect(leftovers()).toEqual([]);
  });

  it('replaces a backup taken before older migrations', async () => {
    await createLegacyDatabase();
    await start();
    await addSetting('APP_URL');

    await expect(startWithFailingMigration()).rejects.toThrow(
      'migration failed',
    );

    expect(await settingsIn(backup)).toEqual(['APP_URL', 'PLEX_SERVER_IP']);
    expect(await tablesIn(backup)).toContain('migrations');
  });

  it('replaces a backup that is not a database', async () => {
    await createLegacyDatabase();
    fs.writeFileSync(backup, 'not a database');

    await start();

    expect(await settingsIn(backup)).toEqual(['PLEX_SERVER_IP']);
  });

  it('closes its connection when a migration fails', async () => {
    const destroy = jest.spyOn(DataSource.prototype, 'destroy');
    await createLegacyDatabase();
    destroy.mockClear();

    await expect(startWithFailingMigration()).rejects.toThrow(
      'migration failed',
    );

    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
