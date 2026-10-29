import { DataSource } from 'typeorm';
import { RaiseRefreshIntervalMinimum1793145600000 } from '@/migrations/20261028-raise-refresh-interval-minimum';

describe('RaiseRefreshIntervalMinimum migration', () => {
  let dataSource: DataSource;

  beforeEach(async () => {
    dataSource = new DataSource({ type: 'sqlite', database: ':memory:' });
    await dataSource.initialize();
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  const migrate = async () => {
    const queryRunner = dataSource.createQueryRunner();
    await new RaiseRefreshIntervalMinimum1793145600000().up(queryRunner);
    await queryRunner.release();
  };

  const storeInterval = async (value: string) => {
    await dataSource.query(
      `CREATE TABLE app_settings (key varchar PRIMARY KEY, value text)`,
    );
    await dataSource.query(
      `INSERT INTO app_settings (key, value) VALUES ('PLEXGUARD_REFRESH_INTERVAL', ?), ('DEVICE_CLEANUP_INTERVAL_DAYS', '2')`,
      [value],
    );
  };

  const stored = async (key: string) => {
    const rows: { value: string }[] = await dataSource.query(
      `SELECT value FROM app_settings WHERE key = ?`,
      [key],
    );
    return rows[0]?.value;
  };

  it.each(['2', '0', '-3', '4.5'])(
    'raises a stored interval of %s to five seconds',
    async (value) => {
      await storeInterval(value);
      await migrate();

      expect(await stored('PLEXGUARD_REFRESH_INTERVAL')).toBe('5');
    },
  );

  it.each(['5', '10', '300', 'abc', ''])(
    'leaves a stored interval of %p alone',
    async (value) => {
      await storeInterval(value);
      await migrate();

      expect(await stored('PLEXGUARD_REFRESH_INTERVAL')).toBe(value);
    },
  );

  it('leaves other settings alone', async () => {
    await storeInterval('2');
    await migrate();

    expect(await stored('DEVICE_CLEANUP_INTERVAL_DAYS')).toBe('2');
  });

  it('does nothing before the settings table exists', async () => {
    await expect(migrate()).resolves.toBeUndefined();
  });
});
