import { DataSource, EntityManager } from 'typeorm';
import { ENTITIES } from '@/database/database.options';
import { serialTransaction } from '@/database/serial-transaction';
import { UserPreference } from '@/entities/user-preference.entity';

describe('serialTransaction', () => {
  let dataSource: DataSource;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: ENTITIES,
      synchronize: true,
    });
    await dataSource.initialize();
  });

  afterEach(() => dataSource.destroy());

  const pause = () => new Promise((resolve) => setTimeout(resolve, 5));

  const insert = async (manager: EntityManager, userId: string) => {
    await pause();
    await manager.getRepository(UserPreference).save({ userId });
    await pause();
  };

  it('keeps a committed write when a concurrent transaction fails', async () => {
    const results = await Promise.allSettled([
      serialTransaction(dataSource.manager, (manager) =>
        insert(manager, 'kept'),
      ),
      serialTransaction(dataSource.manager, async (manager) => {
        await insert(manager, 'discarded');
        throw new Error('rejected');
      }),
      serialTransaction(dataSource.manager, (manager) =>
        insert(manager, 'also-kept'),
      ),
    ]);

    expect(results.map((result) => result.status)).toEqual([
      'fulfilled',
      'rejected',
      'fulfilled',
    ]);
    const stored = await dataSource.getRepository(UserPreference).find();
    expect(stored.map((row) => row.userId).sort()).toEqual([
      'also-kept',
      'kept',
    ]);
    expect(dataSource.manager.queryRunner?.isTransactionActive).toBeFalsy();
  });

  it('runs transactions one after another', async () => {
    const order: string[] = [];
    const step = (name: string) => async () => {
      order.push(`${name}:start`);
      await pause();
      order.push(`${name}:end`);
      return name;
    };

    const names = await Promise.all([
      serialTransaction(dataSource.manager, step('first')),
      serialTransaction(dataSource.manager, step('second')),
    ]);

    expect(names).toEqual(['first', 'second']);
    expect(order).toEqual([
      'first:start',
      'first:end',
      'second:start',
      'second:end',
    ]);
  });
});
