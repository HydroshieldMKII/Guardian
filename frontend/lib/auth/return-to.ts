const RETURN_TO_PARAM = "returnTo";
const ORIGIN_PROBE = "http://return-to.invalid";
const BACKSLASH = "\\";

const hasUnsafeCharacter = (value: string) =>
  Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f || character === BACKSLASH;
  });

export const AUTH_ROUTES = [
  "/login",
  "/setup",
  "/forgot-password",
  "/reset-password",
];

export const safeReturnPath = (value: string | null | undefined) => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (hasUnsafeCharacter(value)) return null;

  const resolved = new URL(value, ORIGIN_PROBE);
  if (AUTH_ROUTES.includes(resolved.pathname)) return null;

  return value;
};

export const loginPathReturningTo = (path: string) => {
  const target = safeReturnPath(path);
  if (!target || target === "/") return "/login";
  return `/login?${RETURN_TO_PARAM}=${encodeURIComponent(target)}`;
};

export const loginPathReturningToCurrentPage = () =>
  loginPathReturningTo(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
  );

export const returnPathFrom = (search: string) =>
  safeReturnPath(new URLSearchParams(search).get(RETURN_TO_PARAM));
