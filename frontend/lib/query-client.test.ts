import { createQueryClient } from "@/lib/query-client";

describe("createQueryClient", () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => consoleError.mockRestore());

  it("fails a query on the first error instead of retrying", async () => {
    const client = createQueryClient();
    const queryFn = jest.fn().mockRejectedValue(new Error("down"));

    await expect(
      client.fetchQuery({ queryKey: ["probe"], queryFn }),
    ).rejects.toThrow("down");
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("logs a failed query with its key", async () => {
    const client = createQueryClient();
    const error = new Error("down");

    await client
      .fetchQuery({ queryKey: ["probe"], queryFn: () => Promise.reject(error) })
      .catch(() => undefined);

    expect(consoleError).toHaveBeenCalledWith(
      "Request failed:",
      ["probe"],
      error,
    );
  });

  it("does not refetch when the window regains focus", () => {
    const { queries, mutations } = createQueryClient().getDefaultOptions();

    expect(queries?.refetchOnWindowFocus).toBe(false);
    expect(mutations?.retry).toBe(false);
  });
});
