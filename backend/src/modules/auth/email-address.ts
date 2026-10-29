export const normalizeEmail = (email: string | null | undefined): string =>
  (email ?? '').trim().toLowerCase();
