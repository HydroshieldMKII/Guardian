import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { databaseOptions } from '@/database/database.options';

async function migratedDataSource(): Promise<DataSource> {
  const directory = mkdtempSync(join(tmpdir(), 'guardian-migrations-'));
  process.on('exit', () => rmSync(directory, { recursive: true, force: true }));
  const options = {
    ...databaseOptions(join(directory, 'schema.db')),
    logging: false,
  };
  await (await new DataSource(options).initialize()).destroy();
  return new DataSource(options);
}

export const dataSource = migratedDataSource();
