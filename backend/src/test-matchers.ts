/**
 * Jest's asymmetric matchers are typed `any`, which trips
 * @typescript-eslint/no-unsafe-assignment wherever they appear inside an
 * expected object. These wrappers narrow them once, here, instead of at
 * every call site.
 */

export const containing = (text: string): string =>
  expect.stringContaining(text) as string;

export const anyDate = (): Date => expect.any(Date) as Date;

export const anyValue = (): unknown => expect.anything() as unknown;

export const arrayContaining = <T>(items: T[]): T[] =>
  expect.arrayContaining(items) as T[];

/**
 * `jest.Mock` defaults its generics to `any`, so reading recorded arguments
 * trips no-unsafe-member-access. These accessors do the narrowing in one
 * place and hand back a typed tuple.
 */
interface RecordedMock {
  mock: { calls: unknown[][]; results: { value: unknown }[] };
}

export const callArgs = <T extends unknown[]>(
  mock: RecordedMock,
  index = 0,
): T => mock.mock.calls[index] as T;

export const callResult = <T>(mock: RecordedMock, index = 0): T =>
  mock.mock.results[index].value as T;
