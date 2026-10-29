import {
  AUTH_ROUTES,
  loginPathReturningTo,
  loginPathReturningToCurrentPage,
  returnPathFrom,
  safeReturnPath,
} from "@/lib/auth/return-to";

describe("safeReturnPath", () => {
  it.each([
    "/",
    "/settings",
    "/settings#system",
    "/?view=users&user=1002",
    "/portal",
  ])("accepts %s", (path) => {
    expect(safeReturnPath(path)).toBe(path);
  });

  it.each([
    null,
    undefined,
    "",
    "settings",
    "//evil.example.com",
    "/\\evil.example.com",
    "/\t/evil.example.com",
    "/\n/evil.example.com",
    "https://evil.example.com",
    "http://evil.example.com/path",
    "javascript:alert(1)",
    "data:text/html,hello",
    "///evil.example.com",
  ])("rejects %s", (path) => {
    expect(safeReturnPath(path)).toBeNull();
  });

  it.each(AUTH_ROUTES)("rejects the auth route %s to avoid loops", (route) => {
    expect(safeReturnPath(route)).toBeNull();
    expect(safeReturnPath(`${route}?x=1`)).toBeNull();
  });
});

describe("loginPathReturningTo", () => {
  it("carries the path, query and hash", () => {
    expect(loginPathReturningTo("/?view=users&user=1002")).toBe(
      "/login?returnTo=%2F%3Fview%3Dusers%26user%3D1002",
    );
    expect(loginPathReturningTo("/settings#system")).toBe(
      "/login?returnTo=%2Fsettings%23system",
    );
  });

  it("stays plain for the home page and unsafe targets", () => {
    expect(loginPathReturningTo("/")).toBe("/login");
    expect(loginPathReturningTo("//evil.example.com")).toBe("/login");
  });
});

describe("loginPathReturningToCurrentPage", () => {
  afterEach(() => window.history.replaceState(null, "", "/"));

  it("returns to the page, its query and its hash after signing in", () => {
    window.history.replaceState(null, "", "/settings?tab=plex#token");

    expect(loginPathReturningToCurrentPage()).toBe(
      `/login?returnTo=${encodeURIComponent("/settings?tab=plex#token")}`,
    );
  });

  it.each(["/", "/login?returnTo=%2Fsettings"])(
    "sends %s to the plain login page",
    (path) => {
      window.history.replaceState(null, "", path);

      expect(loginPathReturningToCurrentPage()).toBe("/login");
    },
  );
});

describe("returnPathFrom", () => {
  it("reads a safe target back out of the query string", () => {
    expect(returnPathFrom("?returnTo=%2Fsettings%23system")).toBe(
      "/settings#system",
    );
  });

  it("ignores missing and unsafe targets", () => {
    expect(returnPathFrom("")).toBeNull();
    expect(returnPathFrom("?returnTo=%2F%2Fevil.example.com")).toBeNull();
    expect(
      returnPathFrom("?returnTo=https%3A%2F%2Fevil.example.com"),
    ).toBeNull();
    expect(returnPathFrom("?returnTo=%2F%5Cevil.example.com")).toBeNull();
  });
});
