import { backendErrorMessage } from "./backend-error";

describe("backendErrorMessage", () => {
  it("explains a network failure", () => {
    expect(backendErrorMessage(new TypeError("Failed to fetch"))).toContain(
      "Unable to reach the backend",
    );
  });

  it.each([
    ["Backend returned 500: Internal", "encountered an internal error"],
    ["Backend returned 502: Bad Gateway", "temporarily unavailable"],
    ["Backend returned 503: Unavailable", "temporarily unavailable"],
    ["Backend returned 404: Not Found", "not properly configured"],
    ["Backend returned 418: Teapot", "not responding correctly"],
  ])("explains %s", (message, expected) => {
    expect(backendErrorMessage(new Error(message))).toContain(expected);
  });

  it("falls back for something that is not an error", () => {
    expect(backendErrorMessage("offline")).toBe(
      "Unable to connect to the backend service.",
    );
  });
});
