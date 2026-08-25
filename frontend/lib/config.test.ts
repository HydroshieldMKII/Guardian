import { BACKEND_URL, config } from "./config";

describe("BACKEND_URL", () => {
  it("points at the backend on loopback", () => {
    expect(BACKEND_URL).toBe("http://localhost:3001");
  });
});

describe("config", () => {
  it("exposes the proxy base path", () => {
    expect(config.api.baseUrl).toBe("/api/pg");
  });

  it("routes the server-side proxy to the backend", () => {
    expect(config.api.backendUrl).toBe(BACKEND_URL);
  });

  it("exposes a positive refresh interval", () => {
    expect(config.app.refreshInterval).toBeGreaterThan(0);
  });

  it("reports an environment", () => {
    expect(typeof config.app.environment).toBe("string");
    expect(config.app.environment.length).toBeGreaterThan(0);
  });
});
