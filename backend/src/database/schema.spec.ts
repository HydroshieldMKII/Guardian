import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DataSource } from 'typeorm';
import { databaseOptions } from '@/database/database.options';

const LEGACY_TABLES = {
  textDefaultBlock: `CREATE TABLE "user_preferences" (
    "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    "user_id" varchar NOT NULL,
    "username" varchar,
    "default_block" text,
    "created_at" datetime NOT NULL DEFAULT (datetime('now')),
    "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT "UQ_458057fa75b66e68a275647da2e" UNIQUE ("user_id")
  )`,
  userDevices: `CREATE TABLE "user_devices" (
    "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    "user_id" varchar NOT NULL,
    "username" varchar,
    "avatar_url" varchar,
    "device_identifier" varchar NOT NULL,
    "device_name" varchar,
    "device_platform" varchar,
    "device_product" varchar,
    "device_version" varchar,
    "status" varchar NOT NULL DEFAULT ('pending'),
    "first_seen" datetime NOT NULL DEFAULT (datetime('now')),
    "last_seen" datetime NOT NULL DEFAULT (datetime('now')),
    "session_count" integer NOT NULL DEFAULT (0),
    "current_session_key" varchar,
    "ip_address" varchar,
    "temporary_access_until" datetime,
    "temporary_access_granted_at" datetime,
    "temporary_access_duration_minutes" integer,
    "temporary_access_bypass_policies" boolean NOT NULL DEFAULT (0)
  )`,
  adminUsers: `CREATE TABLE "admin_users" (
    "id" varchar PRIMARY KEY NOT NULL,
    "username" varchar(255) NOT NULL,
    "email" varchar(255) NOT NULL,
    "passwordHash" varchar(255) NOT NULL,
    "avatarUrl" varchar(255),
    "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
    "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
  )`,
  sessions: `CREATE TABLE "sessions" (
    "id" varchar PRIMARY KEY NOT NULL,
    "token" varchar(512) NOT NULL,
    "userId" varchar(36) NOT NULL,
    "expiresAt" datetime NOT NULL,
    "lastActivityAt" datetime,
    "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
    CONSTRAINT "FK_57de40bc620f456c7311aa3a1e6" FOREIGN KEY ("userId") REFERENCES "admin_users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
  )`,
};

describe('database schema', () => {
  let workDir: string;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'guardian-schema-'));
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  const boot = (database: string): Promise<DataSource> =>
    new DataSource(databaseOptions(database)).initialize();

  const pendingSchemaChanges = async (dataSource: DataSource) => {
    const sql = await dataSource.driver.createSchemaBuilder().log();
    return sql.upQueries.map((query) => query.query);
  };

  const legacyDatabase = async (statements: string[]): Promise<string> => {
    const database = path.join(workDir, 'legacy.db');
    const dataSource = await new DataSource({
      type: 'sqlite',
      database,
    }).initialize();
    try {
      for (const statement of statements) {
        await dataSource.query(statement);
      }
    } finally {
      await dataSource.destroy();
    }
    return database;
  };

  const upgraded = async (
    database: string,
    run: (dataSource: DataSource) => Promise<void>,
  ): Promise<void> => {
    const dataSource = await boot(database);
    try {
      await run(dataSource);
      expect(await pendingSchemaChanges(dataSource)).toEqual([]);
      expect(await dataSource.query('PRAGMA foreign_key_check')).toEqual([]);
    } finally {
      await dataSource.destroy();
    }
  };

  it('builds a new database whose schema matches the entities', async () => {
    await upgraded(path.join(workDir, 'fresh.db'), async () => {});
  });

  it('runs each migration only once', async () => {
    const database = path.join(workDir, 'fresh.db');
    await (await boot(database)).destroy();
    await upgraded(database, async (dataSource) => {
      expect(await dataSource.showMigrations()).toBe(false);
    });
  });

  it('converts text default_block values to booleans', async () => {
    const database = await legacyDatabase([
      LEGACY_TABLES.textDefaultBlock,
      `INSERT INTO user_preferences (user_id, default_block) VALUES ('allowed', 'false'), ('blocked', 'true'), ('inherited', NULL)`,
    ]);
    await upgraded(database, async (dataSource) => {
      expect(
        await dataSource.query(
          'SELECT user_id, default_block FROM user_preferences ORDER BY user_id',
        ),
      ).toEqual([
        { user_id: 'allowed', default_block: 0 },
        { user_id: 'blocked', default_block: 1 },
        { user_id: 'inherited', default_block: null },
      ]);
    });
  });

  it('keeps the autoincrement counter of a rebuilt table', async () => {
    const database = await legacyDatabase([
      LEGACY_TABLES.userDevices,
      `INSERT INTO user_devices (id, user_id, device_identifier) VALUES (1, 'user', 'kept'), (50, 'user', 'deleted')`,
      `DELETE FROM user_devices WHERE id = 50`,
    ]);
    await upgraded(database, async (dataSource) => {
      await dataSource.query(
        `INSERT INTO user_devices (user_id, device_identifier) VALUES ('user', 'new')`,
      );
      expect(
        await dataSource.query(
          `SELECT id, device_identifier FROM user_devices ORDER BY id`,
        ),
      ).toEqual([
        { id: 1, device_identifier: 'kept' },
        { id: 51, device_identifier: 'new' },
      ]);
    });
  });

  it('keeps sessions when rebuilding the admin_users table', async () => {
    const database = await legacyDatabase([
      LEGACY_TABLES.adminUsers,
      LEGACY_TABLES.sessions,
      `INSERT INTO admin_users (id, username, email, passwordHash) VALUES ('admin-1', 'admin', 'admin@example.test', 'hash')`,
      `INSERT INTO sessions (id, token, userId, expiresAt) VALUES ('session-1', 'token-1', 'admin-1', '2099-01-01')`,
    ]);
    await upgraded(database, async (dataSource) => {
      expect(
        await dataSource.query(`SELECT userId, userType FROM sessions`),
      ).toEqual([{ userId: 'admin-1', userType: 'admin' }]);
    });
  });
});
