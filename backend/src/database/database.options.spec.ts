import { readdirSync } from 'fs';
import * as path from 'path';
import { config } from '@/config/app.config';
import {
  ENTITIES,
  MIGRATIONS,
  databaseOptions,
  databasePath,
} from '@/database/database.options';

describe('database options', () => {
  const original = process.env.DATABASE_PATH;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.DATABASE_PATH;
    } else {
      process.env.DATABASE_PATH = original;
    }
  });

  it('uses DATABASE_PATH when set', () => {
    process.env.DATABASE_PATH = '/app/data/plex-guard.db';
    expect(databasePath()).toBe('/app/data/plex-guard.db');
  });

  it('falls back to the configured file in the working directory', () => {
    delete process.env.DATABASE_PATH;
    expect(databasePath()).toBe(path.join(process.cwd(), config.database.path));
  });

  it('never lets TypeORM synchronize the schema', () => {
    expect(databaseOptions('guardian.db')).toMatchObject({
      type: 'sqlite',
      database: 'guardian.db',
      entities: ENTITIES,
      synchronize: false,
      migrations: MIGRATIONS,
      migrationsRun: true,
    });
  });

  it('runs every migration in the migrations folder', () => {
    const files = readdirSync(path.join(__dirname, '..', 'migrations'));
    expect(MIGRATIONS).toHaveLength(files.length);
  });
});
