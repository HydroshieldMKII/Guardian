export type StreamColumn = 0 | 1;

export interface StreamPlacement {
  order: string[];
  columns: Record<string, StreamColumn>;
}

export const EMPTY_PLACEMENT: StreamPlacement = { order: [], columns: {} };

const countIn = (
  order: string[],
  columns: Record<string, StreamColumn>,
  column: StreamColumn,
) => order.filter((key) => columns[key] === column).length;

export function placeStreams(
  keys: string[],
  previous: StreamPlacement,
  pinned: string | null = null,
): StreamPlacement {
  const present = new Set(keys);
  const kept = previous.order.filter((key) => present.has(key));
  const known = new Set(kept);
  const order = [...kept, ...keys.filter((key) => !known.has(key))];

  const columns: Record<string, StreamColumn> = {};
  const counts: [number, number] = [0, 0];
  for (const key of kept) {
    columns[key] = previous.columns[key];
    counts[columns[key]] += 1;
  }
  for (const key of order.slice(kept.length)) {
    const column: StreamColumn = counts[1] < counts[0] ? 1 : 0;
    columns[key] = column;
    counts[column] += 1;
  }

  for (;;) {
    const left = countIn(order, columns, 0);
    const right = countIn(order, columns, 1);
    if (Math.abs(left - right) < 2) break;
    const longer: StreamColumn = left > right ? 0 : 1;
    const movable = order.findLast(
      (key) => columns[key] === longer && key !== pinned,
    );
    if (movable === undefined) break;
    columns[movable] = longer === 0 ? 1 : 0;
  }

  return { order, columns };
}

export function samePlacement(a: StreamPlacement, b: StreamPlacement) {
  return (
    a.order.length === b.order.length &&
    a.order.every(
      (key, index) =>
        key === b.order[index] && a.columns[key] === b.columns[key],
    )
  );
}
