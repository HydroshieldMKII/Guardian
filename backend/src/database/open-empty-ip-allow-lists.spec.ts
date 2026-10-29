import { DataSource } from 'typeorm';
import { UserPreference } from '@/entities/user-preference.entity';
import { OpenEmptyIpAllowLists1793235600000 } from '@/migrations/20261029-open-empty-ip-allow-lists';

type Row = { policy: string; ips: string | null };

describe('OpenEmptyIpAllowLists migration', () => {
  let dataSource: DataSource;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [UserPreference],
    });
    await dataSource.initialize();
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  const migrate = async () => {
    const queryRunner = dataSource.createQueryRunner();
    await new OpenEmptyIpAllowLists1793235600000().up(queryRunner);
    await queryRunner.release();
  };

  const storePreferences = async (...rows: Row[]) => {
    await dataSource.query(
      `CREATE TABLE user_preferences (id integer PRIMARY KEY, ip_access_policy varchar NOT NULL DEFAULT ('all'), allowed_ips json)`,
    );
    for (const [index, { policy, ips }] of rows.entries()) {
      await dataSource.query(
        `INSERT INTO user_preferences (id, ip_access_policy, allowed_ips) VALUES (?, ?, ?)`,
        [index + 1, policy, ips],
      );
    }
  };

  const storedPreferences = async (): Promise<Row[]> =>
    dataSource.query(
      `SELECT ip_access_policy AS policy, allowed_ips AS ips FROM user_preferences ORDER BY id`,
    );

  it.each([
    ['an empty list', '[]'],
    ['no list', null],
  ])('opens a restricted policy with %s', async (_label, ips) => {
    await storePreferences({ policy: 'restricted', ips });
    await migrate();

    expect(await storedPreferences()).toEqual([{ policy: 'all', ips }]);
  });

  it('keeps a restricted policy that lists addresses', async () => {
    const ips = '["10.0.0.0/8"]';
    await storePreferences({ policy: 'restricted', ips });
    await migrate();

    expect(await storedPreferences()).toEqual([{ policy: 'restricted', ips }]);
  });

  it('clears an unreadable list and opens its restricted policy', async () => {
    await storePreferences(
      { policy: 'restricted', ips: '["10.0.0.1"' },
      { policy: 'all', ips: 'not json' },
    );
    await migrate();

    expect(await storedPreferences()).toEqual([
      { policy: 'all', ips: null },
      { policy: 'all', ips: null },
    ]);
  });

  it('leaves open policies alone', async () => {
    await storePreferences(
      { policy: 'all', ips: '[]' },
      { policy: 'all', ips: '["10.0.0.1"]' },
    );
    await migrate();

    expect(await storedPreferences()).toEqual([
      { policy: 'all', ips: '[]' },
      { policy: 'all', ips: '["10.0.0.1"]' },
    ]);
  });

  it('does nothing before the preference table exists', async () => {
    await expect(migrate()).resolves.toBeUndefined();
  });
});
