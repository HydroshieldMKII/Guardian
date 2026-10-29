import { timeRulesApi } from "@/lib/time-rules-api";

const get = jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue([]);
const post = jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue({});
const put = jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue({});
const remove = jest
  .fn<Promise<unknown>, unknown[]>()
  .mockResolvedValue(undefined);

jest.mock("@/lib/api", () => ({
  apiClient: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    put: (...args: unknown[]) => put(...args),
    delete: (...args: unknown[]) => remove(...args),
  },
}));

beforeEach(() => jest.clearAllMocks());

describe("timeRulesApi", () => {
  it("loads every rule a user has, escaping the id", async () => {
    await timeRulesApi.forUser("a/b");
    expect(get).toHaveBeenCalledWith("/users/a%2Fb/rules/all");
  });

  it("loads several users in one request", async () => {
    await timeRulesApi.forUsers(["u-1", "u-2"]);
    expect(post).toHaveBeenCalledWith("/rules/batch", {
      userIds: ["u-1", "u-2"],
    });
  });

  it("creates a rule", async () => {
    const dto = {
      ruleName: "Night",
      dayOfWeek: 1,
      startTime: "20:00",
      endTime: "23:00",
    };
    await timeRulesApi.create("u-1", dto);
    expect(post).toHaveBeenCalledWith("/users/u-1/rules", dto);
  });

  it("updates a rule", async () => {
    await timeRulesApi.update("u-1", 7, { enabled: false });
    expect(put).toHaveBeenCalledWith("/users/u-1/rules/7", { enabled: false });
  });

  it("deletes a rule", async () => {
    await timeRulesApi.remove("u-1", 7);
    expect(remove).toHaveBeenCalledWith("/users/u-1/rules/7");
  });

  it("applies a preset for a device", async () => {
    await timeRulesApi.applyPreset("u-1", "weekdays-only", "device-1");
    expect(post).toHaveBeenCalledWith("/users/u-1/rules/preset", {
      presetType: "weekdays-only",
      deviceIdentifier: "device-1",
    });
  });

  it("applies a user-wide preset without a device", async () => {
    await timeRulesApi.applyPreset("u-1", "weekends-only", "");
    expect(post).toHaveBeenCalledWith("/users/u-1/rules/preset", {
      presetType: "weekends-only",
      deviceIdentifier: undefined,
    });
  });
});
