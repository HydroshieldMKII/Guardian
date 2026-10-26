import { MigrationInterface, QueryRunner } from 'typeorm';

const TABLES: Record<string, string> = {
  admin_users: `
    CREATE TABLE "admin_users" (
      "id" varchar PRIMARY KEY NOT NULL,
      "username" varchar(255) NOT NULL,
      "email" varchar(255) NOT NULL,
      "passwordHash" varchar(255) NOT NULL,
      "avatarUrl" varchar(255),
      "plexUserId" varchar(255),
      "plexUsername" varchar(255),
      "plexEmail" varchar(255),
      "plexThumb" varchar(512),
      "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
      "updatedAt" datetime NOT NULL DEFAULT (datetime('now'))
    )
  `,
  app_settings: `
    CREATE TABLE "app_settings" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "key" varchar NOT NULL,
      "value" text,
      "type" varchar NOT NULL DEFAULT ('string'),
      "private" boolean NOT NULL DEFAULT (0),
      "updatedAt" datetime NOT NULL DEFAULT (CURRENT_TIMESTAMP),
      CONSTRAINT "UQ_975c2db59c65c05fd9c6b63a2ab" UNIQUE ("key")
    )
  `,
  notifications: `
    CREATE TABLE "notifications" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "user_id" varchar NOT NULL,
      "session_history_id" integer,
      "text" text NOT NULL,
      "type" varchar NOT NULL DEFAULT ('info'),
      "read" boolean NOT NULL DEFAULT (0),
      "created_at" datetime NOT NULL DEFAULT (datetime('now')),
      "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
      CONSTRAINT "FK_c9a8d9868dab90b9974ec15ed11" FOREIGN KEY ("session_history_id") REFERENCES "session_history" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
    )
  `,
  password_reset_tokens: `
    CREATE TABLE "password_reset_tokens" (
      "id" varchar PRIMARY KEY NOT NULL,
      "userId" varchar(36) NOT NULL,
      "tokenHash" varchar(64) NOT NULL,
      "expiresAt" datetime NOT NULL,
      "createdAt" datetime NOT NULL DEFAULT (datetime('now'))
    )
  `,
  session_history: `
    CREATE TABLE "session_history" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "session_key" varchar NOT NULL,
      "user_id" varchar NOT NULL,
      "user_device_id" integer,
      "device_address" varchar,
      "content_title" varchar,
      "content_type" varchar,
      "grandparent_title" varchar,
      "parent_title" varchar,
      "year" integer,
      "duration" integer,
      "view_offset" integer,
      "thumb" varchar,
      "art" varchar,
      "video_resolution" varchar,
      "bitrate" integer,
      "container" varchar,
      "video_codec" varchar,
      "audio_codec" varchar,
      "session_location" varchar,
      "bandwidth" integer,
      "started_at" datetime NOT NULL DEFAULT (datetime('now')),
      "ended_at" datetime,
      "terminated" boolean NOT NULL DEFAULT (0),
      "player_state" varchar,
      "product" varchar,
      "rating_key" varchar,
      "parent_rating_key" varchar,
      CONSTRAINT "FK_17945b155cd64a8b018e12245a4" FOREIGN KEY ("user_id") REFERENCES "user_preferences" ("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION,
      CONSTRAINT "FK_ea9b6d54ae12afb9f2cf0a93b48" FOREIGN KEY ("user_device_id") REFERENCES "user_devices" ("id") ON DELETE NO ACTION ON UPDATE NO ACTION
    )
  `,
  sessions: `
    CREATE TABLE "sessions" (
      "id" varchar PRIMARY KEY NOT NULL,
      "token" varchar(512) NOT NULL,
      "userId" varchar(36),
      "userType" varchar(20) NOT NULL DEFAULT ('admin'),
      "plexUserId" varchar(50),
      "plexUsername" varchar(255),
      "plexThumb" varchar(500),
      "expiresAt" datetime NOT NULL,
      "lastActivityAt" datetime,
      "createdAt" datetime NOT NULL DEFAULT (datetime('now')),
      CONSTRAINT "FK_57de40bc620f456c7311aa3a1e6" FOREIGN KEY ("userId") REFERENCES "admin_users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
    )
  `,
  user_devices: `
    CREATE TABLE "user_devices" (
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
      "temporary_access_bypass_policies" boolean NOT NULL DEFAULT (0),
      "exclude_from_concurrent_limit" boolean NOT NULL DEFAULT (0),
      "request_description" varchar(500),
      "request_submitted_at" datetime,
      "request_note_read_at" datetime
    )
  `,
  user_preferences: `
    CREATE TABLE "user_preferences" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "user_id" varchar NOT NULL,
      "username" varchar,
      "avatar_url" varchar,
      "default_block" boolean,
      "hidden" boolean NOT NULL DEFAULT (0),
      "network_policy" varchar NOT NULL DEFAULT ('both'),
      "ip_access_policy" varchar NOT NULL DEFAULT ('all'),
      "allowed_ips" json,
      "concurrent_stream_limit" integer,
      "created_at" datetime NOT NULL DEFAULT (datetime('now')),
      "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
      CONSTRAINT "UQ_458057fa75b66e68a275647da2e" UNIQUE ("user_id")
    )
  `,
  user_time_rules: `
    CREATE TABLE "user_time_rules" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "user_id" varchar NOT NULL,
      "device_identifier" varchar,
      "rule_name" varchar NOT NULL,
      "enabled" boolean NOT NULL DEFAULT (1),
      "day_of_week" integer NOT NULL,
      "start_time" varchar NOT NULL,
      "end_time" varchar NOT NULL,
      "created_at" datetime NOT NULL DEFAULT (datetime('now')),
      "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
      CONSTRAINT "CHK_d6a5b9eee1de3c91f510b3b0d5" CHECK (day_of_week >= 0 AND day_of_week <= 6)
    )
  `,
};

const INDEXES: Record<string, string> = {
  idx_email: `CREATE UNIQUE INDEX "idx_email" ON "admin_users" ("email")`,
  idx_plex_user_id: `CREATE INDEX "idx_plex_user_id" ON "admin_users" ("plexUserId")`,
  idx_username: `CREATE UNIQUE INDEX "idx_username" ON "admin_users" ("username")`,
  IDX_310667f935698fcd8cb319113a: `CREATE INDEX "IDX_310667f935698fcd8cb319113a" ON "notifications" ("user_id", "created_at")`,
  IDX_f8b7ed75170d2d7dca4477cc94: `CREATE INDEX "IDX_f8b7ed75170d2d7dca4477cc94" ON "notifications" ("read")`,
  idx_password_reset_token: `CREATE UNIQUE INDEX "idx_password_reset_token" ON "password_reset_tokens" ("tokenHash")`,
  idx_password_reset_user: `CREATE UNIQUE INDEX "idx_password_reset_user" ON "password_reset_tokens" ("userId")`,
  IDX_810082248f83d7e93a2ef5b686: `CREATE INDEX "IDX_810082248f83d7e93a2ef5b686" ON "session_history" ("user_id", "started_at")`,
  idx_expires_at: `CREATE INDEX "idx_expires_at" ON "sessions" ("expiresAt")`,
  idx_plex_user_id_session: `CREATE INDEX "idx_plex_user_id_session" ON "sessions" ("plexUserId")`,
  idx_token: `CREATE UNIQUE INDEX "idx_token" ON "sessions" ("token")`,
  idx_user_id: `CREATE INDEX "idx_user_id" ON "sessions" ("userId")`,
  idx_user_type: `CREATE INDEX "idx_user_type" ON "sessions" ("userType")`,
  IDX_25971a60c42c668ba1183ebfc1: `CREATE UNIQUE INDEX "IDX_25971a60c42c668ba1183ebfc1" ON "user_devices" ("user_id", "device_identifier")`,
  IDX_458057fa75b66e68a275647da2: `CREATE UNIQUE INDEX "IDX_458057fa75b66e68a275647da2" ON "user_preferences" ("user_id")`,
  IDX_12733555b601e1911a46bb012f: `CREATE INDEX "IDX_12733555b601e1911a46bb012f" ON "user_time_rules" ("user_id")`,
  IDX_9ebc99d98abf4bff9e90c5a986: `CREATE INDEX "IDX_9ebc99d98abf4bff9e90c5a986" ON "user_time_rules" ("user_id", "day_of_week")`,
};

type Row = Record<string, string | number | null>;

type Column = { name: string; type: string };

const canonical = (sql: string | number | null | undefined): string =>
  String(sql ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\( /g, '(')
    .replace(/ \)/g, ')')
    .trim();

async function select(
  queryRunner: QueryRunner,
  sql: string,
  parameters: string[] = [],
): Promise<Row[]> {
  const rows: unknown = await queryRunner.query(sql, parameters);
  return Array.isArray(rows) ? (rows as Row[]) : [];
}

async function storedSql(
  queryRunner: QueryRunner,
  type: 'table' | 'index',
  name: string,
): Promise<string | undefined> {
  const [row] = await select(
    queryRunner,
    'SELECT sql FROM sqlite_master WHERE type = ? AND name = ?',
    [type, name],
  );
  return row ? canonical(row.sql) : undefined;
}

async function columnsOf(
  queryRunner: QueryRunner,
  table: string,
): Promise<Column[]> {
  const rows = await select(
    queryRunner,
    'SELECT name, type FROM pragma_table_info(?)',
    [table],
  );
  return rows.map((row) => ({
    name: String(row.name),
    type: String(row.type).toLowerCase(),
  }));
}

function copyExpression(from: Column, to: Column): string {
  const column = `"${from.name}"`;
  if (to.type === 'boolean' && from.type !== 'boolean') {
    return `CASE ${column} WHEN 'true' THEN 1 WHEN 'false' THEN 0 ELSE ${column} END`;
  }
  return column;
}

async function autoincrementSequence(
  queryRunner: QueryRunner,
  table: string,
): Promise<number | undefined> {
  if (
    (await storedSql(queryRunner, 'table', 'sqlite_sequence')) === undefined
  ) {
    return undefined;
  }
  const [row] = await select(
    queryRunner,
    'SELECT seq FROM sqlite_sequence WHERE name = ?',
    [table],
  );
  return row ? Number(row.seq) : undefined;
}

async function restoreSequence(
  queryRunner: QueryRunner,
  table: string,
  sequence: number | undefined,
): Promise<void> {
  if (sequence === undefined) {
    return;
  }
  await queryRunner.query('DELETE FROM sqlite_sequence WHERE name = ?', [
    table,
  ]);
  await queryRunner.query(
    'INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)',
    [table, sequence],
  );
}

async function rebuildTable(
  queryRunner: QueryRunner,
  table: string,
  ddl: string,
): Promise<void> {
  const temporary = `temporary_${table}`;
  const sequence = await autoincrementSequence(queryRunner, table);

  await queryRunner.query(`DROP TABLE IF EXISTS "${temporary}"`);
  await queryRunner.query(
    ddl.replace(`CREATE TABLE "${table}"`, `CREATE TABLE "${temporary}"`),
  );

  const target = await columnsOf(queryRunner, temporary);
  const copied = (await columnsOf(queryRunner, table)).flatMap((from) => {
    const to = target.find((column) => column.name === from.name);
    return to
      ? [{ name: `"${to.name}"`, value: copyExpression(from, to) }]
      : [];
  });
  await queryRunner.query(
    `INSERT INTO "${temporary}" (${copied.map((c) => c.name).join(', ')}) SELECT ${copied.map((c) => c.value).join(', ')} FROM "${table}"`,
  );

  await queryRunner.query(`DROP TABLE "${table}"`);
  await queryRunner.query(`ALTER TABLE "${temporary}" RENAME TO "${table}"`);
  await restoreSequence(queryRunner, table, sequence);
}

async function syncTable(
  queryRunner: QueryRunner,
  table: string,
  ddl: string,
): Promise<void> {
  const current = await storedSql(queryRunner, 'table', table);
  if (current === undefined) {
    await queryRunner.query(ddl);
  } else if (current !== ddl) {
    await rebuildTable(queryRunner, table, ddl);
  }
}

async function dropUnknownIndexes(queryRunner: QueryRunner): Promise<void> {
  const indexes = await select(
    queryRunner,
    "SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL",
  );
  for (const index of indexes) {
    const name = String(index.name);
    if (String(index.tbl_name) in TABLES && !(name in INDEXES)) {
      await queryRunner.query(`DROP INDEX "${name}"`);
    }
  }
}

async function syncIndex(
  queryRunner: QueryRunner,
  index: string,
  ddl: string,
): Promise<void> {
  const current = await storedSql(queryRunner, 'index', index);
  if (current === ddl) {
    return;
  }
  if (current !== undefined) {
    await queryRunner.query(`DROP INDEX "${index}"`);
  }
  await queryRunner.query(ddl);
}

export class BaselineSchema1792972800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [table, ddl] of Object.entries(TABLES)) {
      await syncTable(queryRunner, table, canonical(ddl));
    }
    await dropUnknownIndexes(queryRunner);
    for (const [index, ddl] of Object.entries(INDEXES)) {
      await syncIndex(queryRunner, index, canonical(ddl));
    }
  }

  public async down(): Promise<void> {}
}
