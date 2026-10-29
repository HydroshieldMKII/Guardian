import { QueryRunner } from 'typeorm';
import { selectRows } from '@/database/migration-rows';

const runnerReturning = (result: unknown) => {
  const query = vi.fn().mockResolvedValue(result);
  return { queryRunner: { query } as Pick<QueryRunner, 'query'>, query };
};

describe('selectRows', () => {
  it('returns the selected rows', async () => {
    const { queryRunner, query } = runnerReturning([{ id: 1 }]);

    await expect(
      selectRows(
        queryRunner as QueryRunner,
        'SELECT id FROM t WHERE x = ?',
        [2],
      ),
    ).resolves.toEqual([{ id: 1 }]);
    expect(query).toHaveBeenCalledWith('SELECT id FROM t WHERE x = ?', [2]);
  });

  it('returns no rows when the driver answers with something else', async () => {
    const { queryRunner } = runnerReturning(undefined);

    await expect(
      selectRows(queryRunner as QueryRunner, 'SELECT id FROM t'),
    ).resolves.toEqual([]);
  });
});
