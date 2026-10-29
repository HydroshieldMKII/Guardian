import type { EntityManager } from 'typeorm';

let queue: Promise<unknown> = Promise.resolve();

export function serialTransaction<T>(
  manager: EntityManager,
  work: (manager: EntityManager) => Promise<T>,
): Promise<T> {
  const run = queue.then(() => manager.transaction(work));
  queue = run.catch(() => undefined);
  return run;
}
