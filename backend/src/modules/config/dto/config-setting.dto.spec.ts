import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ConfigSettingDto } from '@/modules/config/dto/config-setting.dto';
import { UpdateSettingDto } from '@/modules/config/dto/update-setting.dto';
import { configSettingsPipe } from '@/modules/config/dto/config-settings.pipe';

const bulk = (body: unknown): Promise<unknown> =>
  configSettingsPipe.transform(body, {
    type: 'body',
    metatype: Array,
  });

const single = (body: unknown) =>
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }).transform(body, { type: 'body', metatype: UpdateSettingDto });

describe('bulk settings body', () => {
  it('accepts what the settings form sends', async () => {
    const result = (await bulk([
      { key: 'DEFAULT_PAGE', value: 'streams', type: 'string' },
      { key: 'SMTP_ENABLED', value: 'true' },
    ])) as ConfigSettingDto[];

    expect(result).toHaveLength(2);
    expect(result[0]).toBeInstanceOf(ConfigSettingDto);
  });

  it.each([
    ['an empty object', [{}]],
    ['a missing value', [{ key: 'MSG_DEVICE_PENDING' }]],
    ['a null value', [{ key: 'MSG_DEVICE_PENDING', value: null }]],
    ['an object value', [{ key: 'MSG_DEVICE_PENDING', value: { a: 1 } }]],
    ['an array value', [{ key: 'MSG_DEVICE_PENDING', value: ['a'] }]],
    ['a missing key', [{ value: 'x' }]],
    ['an empty key', [{ key: '', value: 'x' }]],
    ['an unknown key', [{ key: 'NOPE', value: 'x' }]],
    ['a prototype key', [{ key: '__proto__', value: 'x' }]],
    ['an extra field', [{ key: 'DEFAULT_PAGE', value: 'x', extra: 1 }]],
  ])('rejects %s', async (_label, body) => {
    await expect(bulk(body)).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([{ a: 1 }, 'text', 5, null])(
    'rejects a body that is not an array: %p',
    async (body) => {
      const failure = await bulk(body).catch((e: Error) => e);

      expect(failure).toBeInstanceOf(BadRequestException);
      expect((failure as Error).message).not.toContain('map is not a function');
    },
  );

  it('names the unknown setting', async () => {
    const failure = await bulk([{ key: '__proto__', value: 'x' }]).catch(
      (e: BadRequestException) => e,
    );

    expect(
      JSON.stringify((failure as BadRequestException).getResponse()),
    ).toContain('known setting');
  });
});

describe('single setting body', () => {
  it.each([{ value: 'x' }, { value: 5 }, { value: false }])(
    'accepts %p',
    async (body) => {
      await expect(single(body)).resolves.toBeInstanceOf(UpdateSettingDto);
    },
  );

  it.each([{}, { value: null }, { value: { a: 1 } }, { value: [1] }])(
    'rejects %p',
    async (body) => {
      await expect(single(body)).rejects.toBeInstanceOf(BadRequestException);
    },
  );
});
