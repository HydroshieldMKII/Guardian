export const DEFAULT_HISTORY_LIMIT = 50;
export const MAX_HISTORY_LIMIT = 200;

const parseNonNegativeInteger = (raw: string | undefined): number | null => {
  if (raw === undefined || !/^\d+$/.test(raw.trim())) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

export const parseHistoryLimit = (raw: string | undefined): number => {
  const parsed = parseNonNegativeInteger(raw);
  if (parsed === null || parsed === 0) return DEFAULT_HISTORY_LIMIT;
  return Math.min(parsed, MAX_HISTORY_LIMIT);
};

export const parseHistoryOffset = (raw: string | undefined): number =>
  parseNonNegativeInteger(raw) ?? 0;
