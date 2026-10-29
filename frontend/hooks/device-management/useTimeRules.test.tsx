import { act, waitFor } from "@testing-library/react";
import { renderHookWithQuery } from "@/test-utils/query";
import { queryKeys } from "@/lib/query-keys";
import { timeRulesApi } from "@/lib/time-rules-api";
import type { CreateTimeRuleDto, UserTimeRule } from "@/types";
import { useTimeRules, useTimeRulesForUsers } from "./useTimeRules";

jest.mock("@/lib/time-rules-api", () => ({
  timeRulesApi: {
    forUser: jest.fn(),
    forUsers: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    applyPreset: jest.fn(),
  },
}));

const api = jest.mocked(timeRulesApi);

const rule = (overrides: Partial<UserTimeRule> = {}): UserTimeRule => ({
  id: 1,
  userId: "u1",
  ruleName: "Bedtime",
  enabled: true,
  dayOfWeek: 1,
  startTime: "20:00",
  endTime: "22:00",
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

const draft = (
  overrides: Partial<CreateTimeRuleDto> = {},
): CreateTimeRuleDto => ({
  ruleName: "Bedtime",
  dayOfWeek: 1,
  startTime: "20:00",
  endTime: "22:00",
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  api.forUser.mockResolvedValue([]);
  api.forUsers.mockResolvedValue({});
  api.create.mockResolvedValue(rule());
  api.update.mockResolvedValue(rule());
  api.remove.mockResolvedValue(undefined);
  api.applyPreset.mockResolvedValue([]);
});

describe("useTimeRulesForUsers", () => {
  it("asks once for every distinct user, in a stable order", async () => {
    api.forUsers.mockResolvedValue({ u1: [rule()], u2: [] });

    const { result } = renderHookWithQuery(() =>
      useTimeRulesForUsers(["u2", "u1", "u2"]),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.forUsers).toHaveBeenCalledTimes(1);
    expect(api.forUsers).toHaveBeenCalledWith(["u1", "u2"]);
    expect(result.current.data).toEqual({ u1: [rule()], u2: [] });
  });

  it("shows the cached rules at once for the same users listed in another order", async () => {
    const { client, result } = renderHookWithQuery(() =>
      useTimeRulesForUsers(["u1", "u2"]),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const second = renderHookWithQuery(
      () => useTimeRulesForUsers(["u2", "u1"]),
      client,
    );

    expect(second.result.current.data).toEqual({});
    expect(
      client.getQueryCache().findAll({ queryKey: queryKeys.timeRules.all }),
    ).toHaveLength(1);
  });

  it("does not ask when there are no users", () => {
    const { result } = renderHookWithQuery(() => useTimeRulesForUsers([]));

    expect(result.current.fetchStatus).toBe("idle");
    expect(api.forUsers).not.toHaveBeenCalled();
  });
});

describe("useTimeRules", () => {
  const loaded = async (rules: UserTimeRule[], deviceIdentifier?: string) => {
    api.forUser.mockResolvedValue(rules);
    const rendered = renderHookWithQuery(() =>
      useTimeRules("u1", deviceIdentifier),
    );
    await waitFor(() => expect(rendered.result.current.isLoading).toBe(false));
    return rendered;
  };

  describe("loading", () => {
    it("keeps only the user-wide rules, sorted by day then start", async () => {
      const { result } = await loaded([
        rule({ id: 1, dayOfWeek: 3, startTime: "08:00", endTime: "09:00" }),
        rule({ id: 2, dayOfWeek: 1, startTime: "21:00", endTime: "22:00" }),
        rule({ id: 3, deviceIdentifier: "tv" }),
        rule({ id: 4, dayOfWeek: 1, startTime: "07:00", endTime: "08:00" }),
      ]);

      expect(api.forUser).toHaveBeenCalledWith("u1");
      expect(result.current.rules.map((r) => r.id)).toEqual([4, 2, 1]);
    });

    it("keeps only the rules of the chosen device", async () => {
      const { result } = await loaded(
        [rule({ id: 1 }), rule({ id: 2, deviceIdentifier: "tv" })],
        "tv",
      );

      expect(result.current.rules.map((r) => r.id)).toEqual([2]);
    });

    it("waits while disabled", () => {
      const { result } = renderHookWithQuery(() =>
        useTimeRules("u1", undefined, false),
      );

      expect(result.current.rules).toEqual([]);
      expect(api.forUser).not.toHaveBeenCalled();
    });

    it("waits until a user is chosen", () => {
      renderHookWithQuery(() => useTimeRules(""));

      expect(api.forUser).not.toHaveBeenCalled();
    });

    it("reports a failed load", async () => {
      jest.spyOn(console, "error").mockImplementation(() => {});
      api.forUser.mockRejectedValue(new Error("down"));

      const { result } = renderHookWithQuery(() => useTimeRules("u1"));

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.rules).toEqual([]);
    });
  });

  describe("createTimeRule", () => {
    it("creates the rule and reloads every time rule query", async () => {
      const { client, result } = await loaded([]);
      const invalidate = jest.spyOn(client, "invalidateQueries");

      await act(async () => {
        await expect(result.current.createTimeRule(draft())).resolves.toEqual(
          rule(),
        );
      });

      expect(api.create).toHaveBeenCalledWith("u1", draft());
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: queryKeys.timeRules.all,
      });
      expect(api.forUser).toHaveBeenCalledTimes(2);
    });

    it("also reloads the users overview", async () => {
      const { client, result } = await loaded([]);
      renderHookWithQuery(() => useTimeRulesForUsers(["u1"]), client);
      await waitFor(() => expect(api.forUsers).toHaveBeenCalledTimes(1));

      await act(async () => {
        await result.current.createTimeRule(draft());
      });

      expect(api.forUsers).toHaveBeenCalledTimes(2);
    });

    it.each([
      ["ends before it starts", "22:00", "20:00"],
      ["ends when it starts", "20:00", "20:00"],
    ])("refuses a rule that %s", async (_, startTime, endTime) => {
      const { result } = await loaded([]);

      await expect(
        result.current.createTimeRule(draft({ startTime, endTime })),
      ).rejects.toThrow("End time must be greater than start time");
      expect(api.create).not.toHaveBeenCalled();
    });

    it("passes a failure through without reloading", async () => {
      const { result } = await loaded([]);
      api.create.mockRejectedValue(new Error("Rule overlaps"));

      await expect(result.current.createTimeRule(draft())).rejects.toThrow(
        "Rule overlaps",
      );
      expect(api.forUser).toHaveBeenCalledTimes(1);
    });
  });

  describe("updateTimeRule", () => {
    it("saves the change and reloads", async () => {
      const { result } = await loaded([rule()]);

      await act(async () => {
        await result.current.updateTimeRule(1, { enabled: false });
      });

      expect(api.update).toHaveBeenCalledWith("u1", 1, { enabled: false });
      expect(api.forUser).toHaveBeenCalledTimes(2);
    });

    it.each([
      ["a new start after the stored end", { startTime: "23:00" }],
      ["a new end before the stored start", { endTime: "19:00" }],
      ["both times reversed", { startTime: "22:00", endTime: "20:00" }],
    ])("refuses %s", async (_, updates) => {
      const { result } = await loaded([rule()]);

      await expect(result.current.updateTimeRule(1, updates)).rejects.toThrow(
        "End time must be greater than start time",
      );
      expect(api.update).not.toHaveBeenCalled();
    });

    it("accepts a new start that still ends after it", async () => {
      const { result } = await loaded([rule()]);

      await act(async () => {
        await result.current.updateTimeRule(1, { startTime: "21:00" });
      });

      expect(api.update).toHaveBeenCalledWith("u1", 1, { startTime: "21:00" });
    });

    it("leaves a rule it has not loaded to the server", async () => {
      const { result } = await loaded([]);

      await act(async () => {
        await result.current.updateTimeRule(9, { startTime: "23:00" });
      });

      expect(api.update).toHaveBeenCalledWith("u1", 9, { startTime: "23:00" });
    });
  });

  describe("deleting", () => {
    it("deletes one rule and reloads", async () => {
      const { result } = await loaded([rule()]);

      await act(async () => {
        await result.current.deleteTimeRule(1);
      });

      expect(api.remove).toHaveBeenCalledWith("u1", 1);
      expect(api.forUser).toHaveBeenCalledTimes(2);
    });

    it("deletes several rules at once", async () => {
      const { result } = await loaded([rule({ id: 1 }), rule({ id: 2 })]);

      await act(async () => {
        await result.current.deleteTimeRules([1, 2]);
      });

      expect(api.remove).toHaveBeenCalledWith("u1", 1);
      expect(api.remove).toHaveBeenCalledWith("u1", 2);
      expect(api.forUser).toHaveBeenCalledTimes(2);
    });

    it("reloads even when a delete fails, so the list shows what is left", async () => {
      const { result } = await loaded([rule({ id: 1 }), rule({ id: 2 })]);
      api.remove.mockRejectedValueOnce(new Error("gone"));

      await act(async () => {
        await expect(result.current.deleteTimeRules([1, 2])).rejects.toThrow(
          "gone",
        );
      });

      expect(api.forUser).toHaveBeenCalledTimes(2);
    });
  });

  describe("applyPreset", () => {
    it("applies the preset to the user and reloads", async () => {
      const { result } = await loaded([]);

      await act(async () => {
        await result.current.applyPreset("weekdays-only");
      });

      expect(api.applyPreset).toHaveBeenCalledWith(
        "u1",
        "weekdays-only",
        undefined,
      );
      expect(api.forUser).toHaveBeenCalledTimes(2);
    });

    it("applies the preset to the chosen device", async () => {
      const { result } = await loaded([], "tv");

      await act(async () => {
        await result.current.applyPreset("weekends-only");
      });

      expect(api.applyPreset).toHaveBeenCalledWith("u1", "weekends-only", "tv");
    });
  });
});
