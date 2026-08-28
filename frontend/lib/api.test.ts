import { ApiError, apiClient } from "./api";

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const fetchMock: jest.MockedFunction<typeof fetch> = jest.fn();

const lastRequest = () => {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error("fetch was never called");
  const [input, init] = call;
  return { url: String(input), init: init ?? {} };
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => jsonResponse({ ok: true }));
  globalThis.fetch = fetchMock;
});

describe("ApiError", () => {
  it("carries the status and keeps its name", () => {
    const error = new ApiError(404, "Not Found");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ApiError");
    expect(error.status).toBe(404);
    expect(error.message).toBe("Not Found");
  });
});

describe("request behaviour", () => {
  it("prefixes the configured base url", async () => {
    await apiClient.get("/health");
    expect(lastRequest().url).toBe("/api/pg/health");
  });

  it("sends JSON headers and credentials by default", async () => {
    await apiClient.get("/health");
    const { init } = lastRequest();
    expect(init.credentials).toBe("include");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json" });
  });

  it("returns the parsed body", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ status: "ok" }));
    await expect(apiClient.get("/health")).resolves.toEqual({ status: "ok" });
  });

  it("serializes a POST body", async () => {
    await apiClient.post("/users/1/hide", { a: 1 });
    const { init } = lastRequest();
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it("omits the body when a POST has no payload", async () => {
    await apiClient.post("/users/1/hide");
    expect(lastRequest().init.body).toBeUndefined();
  });

  it("uses the server message for a failed request", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ message: "Nope" }, 400),
    );
    await expect(apiClient.get("/x")).rejects.toMatchObject({
      status: 400,
      message: "Nope",
    });
  });

  it("falls back to the error field", async () => {
    fetchMock.mockImplementation(async () =>
      jsonResponse({ error: "Bad" }, 400),
    );
    await expect(apiClient.get("/x")).rejects.toMatchObject({ message: "Bad" });
  });

  it("falls back to the status text for a non-JSON error", async () => {
    fetchMock.mockResolvedValue(
      new Response("boom", { status: 500, statusText: "Server Error" }),
    );
    await expect(apiClient.get("/x")).rejects.toMatchObject({
      status: 500,
      message: "HTTP 500: Server Error",
    });
  });

  it("resolves empty on 401 rather than throwing, so callers can fall through to the login redirect", async () => {
    const navigationErrors = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    fetchMock.mockImplementation(async () => jsonResponse({}, 401));
    await expect(apiClient.get("/x")).resolves.toEqual({});

    navigationErrors.mockRestore();
  });
});

describe("endpoint helpers", () => {
  const cases: Array<[string, () => Promise<unknown>, string, string]> = [
    [
      "getDashboardData",
      () => apiClient.getDashboardData(),
      "GET",
      "/api/pg/dashboard",
    ],
    [
      "getHiddenUsers",
      () => apiClient.getHiddenUsers(),
      "GET",
      "/api/pg/users/hidden/list",
    ],
    ["hideUser", () => apiClient.hideUser("7"), "POST", "/api/pg/users/7/hide"],
    ["showUser", () => apiClient.showUser("7"), "POST", "/api/pg/users/7/show"],
    [
      "toggleUserVisibility",
      () => apiClient.toggleUserVisibility("7"),
      "POST",
      "/api/pg/users/7/toggle-visibility",
    ],
    [
      "getUserConcurrentStreamInfo",
      () => apiClient.getUserConcurrentStreamInfo("7"),
      "GET",
      "/api/pg/users/7/concurrent-stream-info",
    ],
    [
      "markDeviceNoteAsRead",
      () => apiClient.markDeviceNoteAsRead(3),
      "POST",
      "/api/pg/devices/3/mark-note-read",
    ],
    [
      "deleteDeviceNote",
      () => apiClient.deleteDeviceNote(3),
      "DELETE",
      "/api/pg/devices/3/note",
    ],
    [
      "getAllNotifications",
      () => apiClient.getAllNotifications(),
      "GET",
      "/api/pg/notifications",
    ],
    [
      "getNotificationsForUser",
      () => apiClient.getNotificationsForUser("7"),
      "GET",
      "/api/pg/notifications/user/7",
    ],
    [
      "getUnreadCount",
      () => apiClient.getUnreadCount("7"),
      "GET",
      "/api/pg/notifications/user/7/unread-count",
    ],
    [
      "markNotificationAsRead",
      () => apiClient.markNotificationAsRead(5),
      "PATCH",
      "/api/pg/notifications/5/read/force",
    ],
    [
      "markNotificationAsReadAuto",
      () => apiClient.markNotificationAsReadAuto(5),
      "PATCH",
      "/api/pg/notifications/5/read",
    ],
    [
      "markAllNotificationsAsRead",
      () => apiClient.markAllNotificationsAsRead(),
      "PATCH",
      "/api/pg/notifications/mark-all-read",
    ],
    [
      "deleteNotification",
      () => apiClient.deleteNotification(5),
      "DELETE",
      "/api/pg/notifications/5",
    ],
    [
      "clearAllNotifications",
      () => apiClient.clearAllNotifications(),
      "DELETE",
      "/api/pg/notifications/clear-all",
    ],
    [
      "testPlexConnection",
      () => apiClient.testPlexConnection(),
      "POST",
      "/api/pg/config/test-plex-connection",
    ],
    [
      "testSmtpConnection",
      () => apiClient.testSmtpConnection(),
      "POST",
      "/api/pg/config/test-smtp-connection",
    ],
    [
      "testAppriseConnection",
      () => apiClient.testAppriseConnection(),
      "POST",
      "/api/pg/config/test-apprise-connection",
    ],
    [
      "getPlexStatus",
      () => apiClient.getPlexStatus(),
      "GET",
      "/api/pg/config/status/plex",
    ],
    [
      "exportDatabase",
      () => apiClient.exportDatabase(),
      "GET",
      "/api/pg/config/database/export",
    ],
    ["getHealth", () => apiClient.getHealth(), "GET", "/api/pg/health"],
  ];

  it.each(cases)("%s hits %s %s", async (_name, invoke, verb, url) => {
    await invoke();
    expect(lastRequest().url).toBe(url);
    expect(lastRequest().init.method).toBe(verb);
  });

  const scriptCases: Array<[string, (p: string) => Promise<unknown>, string]> =
    [
      [
        "resetStreamCounts",
        (p) => apiClient.resetStreamCounts(p),
        "/api/pg/config/scripts/reset-stream-counts",
      ],
      [
        "clearSessionHistory",
        (p) => apiClient.clearSessionHistory(p),
        "/api/pg/config/scripts/clear-session-history",
      ],
      [
        "deleteAllDevices",
        (p) => apiClient.deleteAllDevices(p),
        "/api/pg/config/scripts/delete-all-devices",
      ],
      [
        "resetDatabase",
        (p) => apiClient.resetDatabase(p),
        "/api/pg/config/scripts/reset-database",
      ],
    ];

  it.each(scriptCases)(
    "%s posts the confirmation password",
    async (_name, invoke, url) => {
      await invoke("hunter2");
      expect(lastRequest().url).toBe(url);
      expect(lastRequest().init.body).toBe(
        JSON.stringify({ password: "hunter2" }),
      );
    },
  );

  it("updateUserIPPolicy posts the supplied updates", async () => {
    await apiClient.updateUserIPPolicy("7", { networkPolicy: "lan" });
    expect(lastRequest().url).toBe("/api/pg/users/7/ip-policy");
    expect(lastRequest().init.body).toBe(
      JSON.stringify({ networkPolicy: "lan" }),
    );
  });

  it("updateUserConcurrentStreamLimit wraps the value", async () => {
    await apiClient.updateUserConcurrentStreamLimit("7", 3);
    expect(lastRequest().url).toBe("/api/pg/users/7/concurrent-stream-limit");
    expect(lastRequest().init.body).toBe(
      JSON.stringify({ concurrentStreamLimit: 3 }),
    );
  });

  it("updateUserConcurrentStreamLimit accepts a null reset", async () => {
    await apiClient.updateUserConcurrentStreamLimit("7", null);
    expect(lastRequest().init.body).toBe(
      JSON.stringify({ concurrentStreamLimit: null }),
    );
  });

  it("updateDeviceExcludeFromConcurrentLimit wraps the flag", async () => {
    await apiClient.updateDeviceExcludeFromConcurrentLimit(3, true);
    expect(lastRequest().url).toBe(
      "/api/pg/devices/3/exclude-from-concurrent-limit",
    );
    expect(lastRequest().init.body).toBe(JSON.stringify({ exclude: true }));
  });

  it("updateConfig issues a PUT", async () => {
    await apiClient.updateConfig({ TIMEZONE: "+02:00" });
    expect(lastRequest().url).toBe("/api/pg/config");
    expect(lastRequest().init.method).toBe("PUT");
  });

  it("importDatabase posts form data without forcing a JSON content type", async () => {
    const form = new FormData();
    await apiClient.importDatabase(form);
    expect(lastRequest().url).toBe("/api/pg/config/database/import");
    expect(lastRequest().init.body).toBe(form);
    expect(lastRequest().init.headers).toEqual({});
  });

  it("updateProfile and updatePassword patch the auth endpoints", async () => {
    await apiClient.updateProfile({ username: "a" });
    expect(lastRequest().url).toBe("/api/pg/auth/profile");
    expect(lastRequest().init.method).toBe("PATCH");

    await apiClient.updatePassword({ password: "b" });
    expect(lastRequest().url).toBe("/api/pg/auth/password");
    expect(lastRequest().init.method).toBe("PATCH");
  });
});
