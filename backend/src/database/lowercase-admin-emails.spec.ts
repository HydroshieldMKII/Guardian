import { DataSource } from 'typeorm';
import { LowercaseAdminEmails1793232000000 } from '@/migrations/20261029-lowercase-admin-emails';

describe('LowercaseAdminEmails migration', () => {
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
    await new LowercaseAdminEmails1793232000000().up(queryRunner);
    await queryRunner.release();
  };

  const storeAdmins = async (...emails: (string | null)[]) => {
    await dataSource.query(
      `CREATE TABLE admin_users (id varchar PRIMARY KEY, email varchar UNIQUE)`,
    );
    for (const [index, email] of emails.entries()) {
      await dataSource.query(
        `INSERT INTO admin_users (id, email) VALUES (?, ?)`,
        [`admin-${index}`, email],
      );
    }
  };

  const storedEmails = async () => {
    const rows: { email: string | null }[] = await dataSource.query(
      `SELECT email FROM admin_users ORDER BY id`,
    );
    return rows.map(({ email }) => email);
  };

  it('lowercases and trims a stored admin email', async () => {
    await storeAdmins(' Admin@Example.COM ');
    await migrate();

    expect(await storedEmails()).toEqual(['admin@example.com']);
  });

  it('lowercases letters outside plain ASCII', async () => {
    await storeAdmins('ÉQUIPE@example.com');
    await migrate();

    expect(await storedEmails()).toEqual(['équipe@example.com']);
  });

  it('leaves emails that would clash with another admin alone', async () => {
    await storeAdmins('Admin@Example.com', 'admin@example.com', 'OTHER@x.io');
    await migrate();

    expect(await storedEmails()).toEqual([
      'Admin@Example.com',
      'admin@example.com',
      'other@x.io',
    ]);
  });

  it('leaves empty and missing emails alone', async () => {
    await storeAdmins('', null);
    await migrate();

    expect(await storedEmails()).toEqual(['', null]);
  });

  it('does nothing before the admin table exists', async () => {
    await expect(migrate()).resolves.toBeUndefined();
  });
});
