describe("getBackendUrl", () => {
  const originalUrl = process.env.BACKEND_URL;

  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.BACKEND_URL;
    } else {
      process.env.BACKEND_URL = originalUrl;
    }
    jest.resetModules();
  });

  const loadConfig = async () => {
    jest.resetModules();
    return import("./config");
  };

  it("targets loopback by default", async () => {
    delete process.env.BACKEND_URL;
    const { getBackendUrl } = await loadConfig();
    expect(getBackendUrl()).toBe("http://localhost:3001");
  });

  it("honours an explicit override", async () => {
    process.env.BACKEND_URL = "http://api.internal:9000";
    const { getBackendUrl } = await loadConfig();
    expect(getBackendUrl()).toBe("http://api.internal:9000");
  });

  it("falls back to loopback when the override is empty", async () => {
    process.env.BACKEND_URL = "";
    const { getBackendUrl } = await loadConfig();
    expect(getBackendUrl()).toBe("http://localhost:3001");
  });
});

describe("config", () => {
  it("exposes the proxy base path", async () => {
    const { config } = await import("./config");
    expect(config.api.baseUrl).toBe("/api/pg");
  });

  it("exposes a positive refresh interval", async () => {
    const { config } = await import("./config");
    expect(config.app.refreshInterval).toBeGreaterThan(0);
  });

  it("reports an environment", async () => {
    const { config } = await import("./config");
    expect(typeof config.app.environment).toBe("string");
    expect(config.app.environment.length).toBeGreaterThan(0);
  });
});
