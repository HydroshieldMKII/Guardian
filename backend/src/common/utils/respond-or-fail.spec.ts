import { ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { respondOrFail } from '@/common/utils/respond-or-fail';

const failure = async (call: Promise<unknown>): Promise<HttpException> => {
  try {
    await call;
  } catch (error) {
    if (error instanceof HttpException) return error;
    throw error;
  }
  throw new Error('expected the call to reject');
};

describe('respondOrFail', () => {
  it('returns what the work resolves to', async () => {
    await expect(respondOrFail(() => Promise.resolve(7), 'nope')).resolves.toBe(
      7,
    );
  });

  it('hides the cause behind the fallback by default', async () => {
    const error = await failure(
      respondOrFail(() => Promise.reject(new Error('disk on fire')), 'nope'),
    );

    expect(error.message).toBe('nope');
    expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
  });

  it('exposes the cause when asked', async () => {
    const error = await failure(
      respondOrFail(() => Promise.reject(new Error('bad value')), 'nope', {
        status: HttpStatus.BAD_REQUEST,
        exposeCause: true,
      }),
    );

    expect(error.message).toBe('bad value');
    expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST);
  });

  it('falls back when the cause carries no message', async () => {
    const error = await failure(
      respondOrFail(() => Promise.reject(new Error('')), 'nope', {
        exposeCause: true,
      }),
    );

    expect(error.message).toBe('nope');
  });

  it('lets an HTTP error through untouched', async () => {
    const forbidden = new ForbiddenException('Invalid password');

    await expect(
      respondOrFail(() => Promise.reject(forbidden), 'nope'),
    ).rejects.toBe(forbidden);
  });
});
