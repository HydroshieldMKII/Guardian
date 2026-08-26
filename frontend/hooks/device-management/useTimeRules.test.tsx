import { act, renderHook } from "@testing-library/react";
import { CreateTimeRuleDto, UserTimeRule } from "@/types";
import { useTimeRules } from "./useTimeRules";

const fetchMock = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

const lastCall = () => fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
const bodyOf = () => JSON.parse(lastCall()[1]?.body as string);

const rule = (overrides: Partial<UserTimeRule> = {}): UserTimeRule =>
  ({
    id: 1,
    userId: "u1",
    deviceIdentifier: null,
    dayOfWeek: 1,
    startTime: "20:00",
    endTime: "22:00",
    ruleName: "Bedtime",
    enabled: true,
    ...overrides,
  }) as UserTimeRule;

const draft = (overrides: Partial<CreateTimeRuleDto> = {}): CreateTimeRuleDto =>
  ({
    ruleName: "Bedtime",
    dayOfWeek: 1,
    startTime: "20:00",
    endTime: "22:00",
    ...overrides,
  }) as CreateTimeRuleDto;

const setup = () => renderHook(() => useTimeRules());

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = fetchMock as typeof fetch;
  fetchMock.mockImplementation(async () => ok([]));

  const { result } = setup();
  act(() => result.current.clearCache());
});

describe("fetchAllTimeRules", () => {
  it("asks for every uncached user in one batch", async () => {
    fetchMock.mockImplementation(async () => ok({ u1: [rule()], u2: [] }));
    const { result } = setup();

    await act(async () => {
      await result.current.fetchAllTimeRules(["u1", "u2"]);
    });

    expect(lastCall()[0]).toBe("/api/pg/rules/batch");
    expect(bodyOf()).toEqual({ userIds: ["u1", "u2"] });
  });

  it("serves a later read from the cache", async () => {
    fetchMock.mockImplementation(async () => ok({ u1: [rule()] }));
    const { result } = setup();

    await act(async () => {
      await result.current.fetchAllTimeRules(["u1"]);
    });
    fetchMock.mockClear();

    await act(async () => {
      await result.current.fetchAllTimeRules(["u1"]);
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("only asks for the users it does not already hold", async () => {
    fetchMock.mockImplementation(async () => ok({ u1: [rule()] }));
    const { result } = setup();

    await act(async () => {
      await result.current.fetchAllTimeRules(["u1"]);
    });
    await act(async () => {
      await result.current.fetchAllTimeRules(["u1", "u2"]);
    });

    expect(bodyOf()).toEqual({ userIds: ["u2"] });
  });

  it("caches an empty list for a user the response omitted", async () => {
    fetchMock.mockImplementation(async () => ok({ u1: [rule()] }));
    const { result } = setup();

    await act(async () => {
      await result.current.fetchAllTimeRules(["u1", "u2"]);
    });

    let rules: UserTimeRule[] | undefined;
    await act(async () => {
      rules = await result.current.getAllTimeRules("u2");
    });

    expect(rules).toEqual([]);
  });

  it("caches empty lists on a server error so it stops retrying", async () => {
    fetchMock.mockImplementation(
      async () => new Response("", { status: 500, statusText: "boom" }),
    );
    const { result } = setup();

    await act(async () => {
      await result.current.fetchAllTimeRules(["u1"]);
    });
    fetchMock.mockClear();

    await act(async () => {
      await result.current.fetchAllTimeRules(["u1"]);
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("leaves an already cached user alone when the batch fails", async () => {
    fetchMock.mockImplementation(async () => ok({ u1: [rule({ id: 9 })] }));
    const { result } = setup();
    await act(async () => {
      await result.current.fetchAllTimeRules(["u1"]);
    });

    fetchMock.mockImplementation(async () => {
      throw new Error("offline");
    });
    await act(async () => {
      await result.current.fetchAllTimeRules(["u1", "u2"]);
    });

    fetchMock.mockClear();
    let rules: UserTimeRule[] | undefined;
    await act(async () => {
      rules = await result.current.getAllTimeRules("u1");
    });
    expect(rules?.map((r) => r.id)).toEqual([9]);
  });

  it("caches empty lists on a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { result } = setup();

    await act(async () => {
      await result.current.fetchAllTimeRules(["u1"]);
    });

    let rules: UserTimeRule[] | undefined;
    await act(async () => {
      rules = await result.current.getAllTimeRules("u1");
    });

    expect(rules).toEqual([]);
  });
});

describe("getTimeRules", () => {
  it("fetches the user-wide rules when nothing is cached", async () => {
    fetchMock.mockImplementation(async () => ok([rule()]));
    const { result } = setup();

    await act(async () => {
      await result.current.getTimeRules("u1");
    });

    expect(lastCall()[0]).toBe("/api/pg/users/u1/rules");
  });

  it("fetches the device-scoped rules when a device is named", async () => {
    fetchMock.mockImplementation(async () => ok([]));
    const { result } = setup();

    await act(async () => {
      await result.current.getTimeRules("u1", "dev 1");
    });

    expect(lastCall()[0]).toBe("/api/pg/users/u1/rules/device/dev%201");
  });

  it("returns only user-wide rules from the cache", async () => {
    fetchMock.mockImplementation(async () =>
      ok({
        u1: [rule({ id: 1 }), rule({ id: 2, deviceIdentifier: "dev-1" })],
      }),
    );
    const { result } = setup();

    await act(async () => {
      await result.current.fetchAllTimeRules(["u1"]);
    });

    let rules: UserTimeRule[] | undefined;
    await act(async () => {
      rules = await result.current.getTimeRules("u1");
    });

    expect(rules?.map((r) => r.id)).toEqual([1]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("filters the cache down to one device", async () => {
    fetchMock.mockImplementation(async () =>
      ok({
        u1: [rule({ id: 1 }), rule({ id: 2, deviceIdentifier: "dev-1" })],
      }),
    );
    const { result } = setup();

    await act(async () => {
      await result.current.fetchAllTimeRules(["u1"]);
    });

    let rules: UserTimeRule[] | undefined;
    await act(async () => {
      rules = await result.current.getTimeRules("u1", "dev-1");
    });

    expect(rules?.map((r) => r.id)).toEqual([2]);
  });

  it("propagates a server rejection", async () => {
    fetchMock.mockImplementation(async () => new Response("", { status: 500 }));
    const { result } = setup();

    await expect(
      act(async () => {
        await result.current.getTimeRules("u1");
      }),
    ).rejects.toThrow("Failed to fetch time rules");
  });
});

describe("getAllTimeRules", () => {
  it("fetches every rule for a user", async () => {
    fetchMock.mockImplementation(async () => ok([rule()]));
    const { result } = setup();

    let rules: UserTimeRule[] | undefined;
    await act(async () => {
      rules = await result.current.getAllTimeRules("u1");
    });

    expect(lastCall()[0]).toBe("/api/pg/users/u1/rules/all");
    expect(rules).toHaveLength(1);
  });

  it("serves a repeat read from the cache", async () => {
    fetchMock.mockImplementation(async () => ok([rule()]));
    const { result } = setup();

    await act(async () => {
      await result.current.getAllTimeRules("u1");
    });
    fetchMock.mockClear();

    await act(async () => {
      await result.current.getAllTimeRules("u1");
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("propagates a server rejection", async () => {
    fetchMock.mockImplementation(async () => new Response("", { status: 500 }));
    const { result } = setup();

    await expect(
      act(async () => {
        await result.current.getAllTimeRules("u1");
      }),
    ).rejects.toThrow("Failed to fetch all time rules");
  });
});

describe("createTimeRule", () => {
  it("posts the rule and adds it to the cache", async () => {
    fetchMock.mockImplementation(async () => ok(rule({ id: 9 })));
    const { result } = setup();

    await act(async () => {
      await result.current.createTimeRule("u1", draft());
    });

    expect(lastCall()[0]).toBe("/api/pg/users/u1/rules");
    expect(lastCall()[1]?.method).toBe("POST");

    fetchMock.mockClear();
    let rules: UserTimeRule[] | undefined;
    await act(async () => {
      rules = await result.current.getAllTimeRules("u1");
    });

    expect(rules?.map((r) => r.id)).toEqual([9]);
  });

  it("refuses a rule that ends before it starts", async () => {
    const { result } = setup();

    await expect(
      act(async () => {
        await result.current.createTimeRule(
          "u1",
          draft({ startTime: "22:00", endTime: "20:00" }),
        );
      }),
    ).rejects.toThrow("End time must be greater than start time");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces the server's error message", async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ message: "overlaps another rule" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const { result } = setup();

    await expect(
      act(async () => {
        await result.current.createTimeRule("u1", draft());
      }),
    ).rejects.toThrow("overlaps another rule");
  });

  it("falls back to a generic message when the error body is unreadable", async () => {
    fetchMock.mockImplementation(
      async () => new Response("not json", { status: 400 }),
    );
    const { result } = setup();

    await expect(
      act(async () => {
        await result.current.createTimeRule("u1", draft());
      }),
    ).rejects.toThrow("Unknown error");
  });
});

describe("updateTimeRule", () => {
  const seedCache = async (result: { current: ReturnType<typeof useTimeRules> }) => {
    fetchMock.mockImplementation(async () => ok({ u1: [rule({ id: 1 })] }));
    await act(async () => {
      await result.current.fetchAllTimeRules(["u1"]);
    });
  };

  it("puts the change and updates the cached rule", async () => {
    const { result } = setup();
    await seedCache(result);

    fetchMock.mockImplementation(async () =>
      ok(rule({ id: 1, ruleName: "Renamed" })),
    );

    await act(async () => {
      await result.current.updateTimeRule("u1", 1, { ruleName: "Renamed" });
    });

    expect(lastCall()[0]).toBe("/api/pg/users/u1/rules/1");
    expect(lastCall()[1]?.method).toBe("PUT");

    let rules: UserTimeRule[] | undefined;
    await act(async () => {
      rules = await result.current.getAllTimeRules("u1");
    });
    expect(rules?.[0].ruleName).toBe("Renamed");
  });

  it("validates a new start time against the cached end time", async () => {
    const { result } = setup();
    await seedCache(result);

    await expect(
      act(async () => {
        await result.current.updateTimeRule("u1", 1, { startTime: "23:00" });
      }),
    ).rejects.toThrow("End time must be greater than start time");
  });

  it("accepts a valid time change", async () => {
    const { result } = setup();
    await seedCache(result);
    fetchMock.mockImplementation(async () => ok(rule({ id: 1 })));

    await act(async () => {
      await result.current.updateTimeRule("u1", 1, { endTime: "23:00" });
    });

    expect(lastCall()[1]?.method).toBe("PUT");
  });

  it("skips validation for a rule it has not cached", async () => {
    fetchMock.mockImplementation(async () => ok(rule({ id: 99 })));
    const { result } = setup();

    await act(async () => {
      await result.current.updateTimeRule("u1", 99, { startTime: "23:00" });
    });

    expect(lastCall()[1]?.method).toBe("PUT");
  });

  it("surfaces the server's error message", async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ message: "rule is locked" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const { result } = setup();

    await expect(
      act(async () => {
        await result.current.updateTimeRule("u1", 1, { enabled: false });
      }),
    ).rejects.toThrow("rule is locked");
  });
});

describe("updateTimeRule error handling", () => {
  it("falls back to a generic message when the error body names none", async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({}), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const { result } = setup();

    await expect(
      act(async () => {
        await result.current.updateTimeRule("u1", 1, { endTime: "23:00" });
      }),
    ).rejects.toThrow("Failed to update time rule");
  });

  it("reports an unreadable error body as an unknown error", async () => {
    fetchMock.mockImplementation(
      async () => new Response("not json", { status: 500 }),
    );
    const { result } = setup();

    await expect(
      act(async () => {
        await result.current.updateTimeRule("u1", 1, { endTime: "23:00" });
      }),
    ).rejects.toThrow("Unknown error");
  });

  it("leaves the other cached rules untouched", async () => {
    fetchMock.mockImplementation(async () =>
      ok({ u1: [rule({ id: 1 }), rule({ id: 2, ruleName: "Homework" })] }),
    );
    const { result } = setup();
    await act(async () => {
      await result.current.fetchAllTimeRules(["u1"]);
    });

    fetchMock.mockImplementation(async () =>
      ok(rule({ id: 1, ruleName: "Renamed" })),
    );
    await act(async () => {
      await result.current.updateTimeRule("u1", 1, { ruleName: "Renamed" });
    });

    let rules: UserTimeRule[] | undefined;
    await act(async () => {
      rules = await result.current.getAllTimeRules("u1");
    });
    expect(rules?.find((r) => r.id === 2)?.ruleName).toBe("Homework");
  });
});

describe("deleteTimeRule", () => {
  it("deletes the rule and drops it from the cache", async () => {
    fetchMock.mockImplementation(async () =>
      ok({ u1: [rule({ id: 1 }), rule({ id: 2 })] }),
    );
    const { result } = setup();
    await act(async () => {
      await result.current.fetchAllTimeRules(["u1"]);
    });

    fetchMock.mockImplementation(async () => ok({}));
    await act(async () => {
      await result.current.deleteTimeRule("u1", 1);
    });

    expect(lastCall()[0]).toBe("/api/pg/users/u1/rules/1");
    expect(lastCall()[1]?.method).toBe("DELETE");

    let rules: UserTimeRule[] | undefined;
    await act(async () => {
      rules = await result.current.getAllTimeRules("u1");
    });
    expect(rules?.map((r) => r.id)).toEqual([2]);
  });

  it("propagates a server rejection", async () => {
    fetchMock.mockImplementation(async () => new Response("", { status: 500 }));
    const { result } = setup();

    await expect(
      act(async () => {
        await result.current.deleteTimeRule("u1", 1);
      }),
    ).rejects.toThrow("Failed to delete time rule");
  });
});

describe("createPreset", () => {
  it("posts the preset type and replaces the cache", async () => {
    fetchMock.mockImplementation(async () => ok([rule({ id: 5 })]));
    const { result } = setup();

    await act(async () => {
      await result.current.createPreset("u1", "weekdays-only");
    });

    expect(lastCall()[0]).toBe("/api/pg/users/u1/rules/preset");
    expect(bodyOf()).toEqual({ presetType: "weekdays-only" });

    fetchMock.mockClear();
    let rules: UserTimeRule[] | undefined;
    await act(async () => {
      rules = await result.current.getAllTimeRules("u1");
    });
    expect(rules?.map((r) => r.id)).toEqual([5]);
  });

  it("scopes the preset to a device when one is named", async () => {
    fetchMock.mockImplementation(async () => ok([]));
    const { result } = setup();

    await act(async () => {
      await result.current.createPreset("u1", "weekends-only", "dev-1");
    });

    expect(bodyOf()).toEqual({
      presetType: "weekends-only",
      deviceIdentifier: "dev-1",
    });
  });

  it("surfaces the server's error message", async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({ message: "preset conflicts" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const { result } = setup();

    await expect(
      act(async () => {
        await result.current.createPreset("u1", "weekdays-only");
      }),
    ).rejects.toThrow("preset conflicts");
  });

  it("falls back to a generic message when the error body names none", async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(JSON.stringify({}), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const { result } = setup();

    await expect(
      act(async () => {
        await result.current.createPreset("u1", "weekdays-only");
      }),
    ).rejects.toThrow("Failed to create preset");
  });

  it("reports an unreadable error body as an unknown error", async () => {
    fetchMock.mockImplementation(
      async () => new Response("not json", { status: 500 }),
    );
    const { result } = setup();

    await expect(
      act(async () => {
        await result.current.createPreset("u1", "weekdays-only");
      }),
    ).rejects.toThrow("Unknown error");
  });
});

describe("toggleTimeRule", () => {
  it("toggles the rule and updates the cache", async () => {
    fetchMock.mockImplementation(async () => ok({ u1: [rule({ id: 1 })] }));
    const { result } = setup();
    await act(async () => {
      await result.current.fetchAllTimeRules(["u1"]);
    });

    fetchMock.mockImplementation(async () =>
      ok(rule({ id: 1, enabled: false })),
    );
    await act(async () => {
      await result.current.toggleTimeRule("u1", 1);
    });

    expect(lastCall()[0]).toBe("/api/pg/users/u1/rules/1/toggle");

    let rules: UserTimeRule[] | undefined;
    await act(async () => {
      rules = await result.current.getAllTimeRules("u1");
    });
    expect(rules?.[0].enabled).toBe(false);
  });

  it("propagates a server rejection", async () => {
    fetchMock.mockImplementation(async () => new Response("", { status: 500 }));
    const { result } = setup();

    await expect(
      act(async () => {
        await result.current.toggleTimeRule("u1", 1);
      }),
    ).rejects.toThrow("Failed to toggle time rule");
  });

  it("leaves the other cached rules untouched", async () => {
    fetchMock.mockImplementation(async () =>
      ok({ u1: [rule({ id: 1 }), rule({ id: 2, ruleName: "Homework" })] }),
    );
    const { result } = setup();
    await act(async () => {
      await result.current.fetchAllTimeRules(["u1"]);
    });

    fetchMock.mockImplementation(async () =>
      ok(rule({ id: 1, enabled: false })),
    );
    await act(async () => {
      await result.current.toggleTimeRule("u1", 1);
    });

    let rules: UserTimeRule[] | undefined;
    await act(async () => {
      rules = await result.current.getAllTimeRules("u1");
    });
    expect(rules?.find((r) => r.id === 2)?.ruleName).toBe("Homework");
  });

  it("toggles a rule for a user it has never cached", async () => {
    fetchMock.mockImplementation(async () =>
      ok(rule({ id: 1, enabled: false })),
    );
    const { result } = setup();

    await act(async () => {
      await result.current.toggleTimeRule("u-fresh", 1);
    });

    expect(lastCall()[0]).toBe("/api/pg/users/u-fresh/rules/1/toggle");
  });
});

describe("checkStreamingAllowed", () => {
  it("asks whether streaming is allowed right now", async () => {
    fetchMock.mockImplementation(async () =>
      ok({ allowed: true, reason: "no rules" }),
    );
    const { result } = setup();

    let verdict: { allowed: boolean; reason: string } | undefined;
    await act(async () => {
      verdict = await result.current.checkStreamingAllowed("u1");
    });

    expect(lastCall()[0]).toBe("/api/pg/users/u1/rules/check");
    expect(verdict).toEqual({ allowed: true, reason: "no rules" });
  });

  it("scopes the check to a device when one is named", async () => {
    fetchMock.mockImplementation(async () => ok({ allowed: true, reason: "" }));
    const { result } = setup();

    await act(async () => {
      await result.current.checkStreamingAllowed("u1", "dev 1");
    });

    expect(lastCall()[0]).toBe(
      "/api/pg/users/u1/rules/check?deviceIdentifier=dev%201",
    );
  });

  it("propagates a server rejection", async () => {
    fetchMock.mockImplementation(async () => new Response("", { status: 500 }));
    const { result } = setup();

    await expect(
      act(async () => {
        await result.current.checkStreamingAllowed("u1");
      }),
    ).rejects.toThrow("Failed to check streaming status");
  });
});

describe("hasTimeRules", () => {
  it("answers from the full cache without a request", async () => {
    fetchMock.mockImplementation(async () => ok({ u1: [rule()] }));
    const { result } = setup();
    await act(async () => {
      await result.current.fetchAllTimeRules(["u1"]);
    });
    fetchMock.mockClear();

    let hasRules: boolean | undefined;
    await act(async () => {
      hasRules = await result.current.hasTimeRules("u1");
    });

    expect(hasRules).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports false when every cached rule is disabled", async () => {
    fetchMock.mockImplementation(async () =>
      ok({ u1: [rule({ enabled: false })] }),
    );
    const { result } = setup();
    await act(async () => {
      await result.current.fetchAllTimeRules(["u1"]);
    });

    let hasRules: boolean | undefined;
    await act(async () => {
      hasRules = await result.current.hasTimeRules("u1");
    });

    expect(hasRules).toBe(false);
  });

  it("asks the server when nothing is cached", async () => {
    fetchMock.mockImplementation(async () => ok([rule()]));
    const { result } = setup();

    let hasRules: boolean | undefined;
    await act(async () => {
      hasRules = await result.current.hasTimeRules("u1");
    });

    expect(lastCall()[0]).toBe("/api/pg/users/u1/rules");
    expect(hasRules).toBe(true);
  });

  it("remembers the answer for the next call", async () => {
    fetchMock.mockImplementation(async () => ok([rule()]));
    const { result } = setup();

    await act(async () => {
      await result.current.hasTimeRules("u1");
    });
    fetchMock.mockClear();
    await act(async () => {
      await result.current.hasTimeRules("u1");
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports false when the server sends something unexpected", async () => {
    fetchMock.mockImplementation(async () => ok({ not: "an array" }));
    const { result } = setup();

    let hasRules: boolean | undefined;
    await act(async () => {
      hasRules = await result.current.hasTimeRules("u1");
    });

    expect(hasRules).toBe(false);
  });

  it("reports false on a server rejection", async () => {
    fetchMock.mockImplementation(async () => new Response("", { status: 500 }));
    const { result } = setup();

    let hasRules: boolean | undefined;
    await act(async () => {
      hasRules = await result.current.hasTimeRules("u1");
    });

    expect(hasRules).toBe(false);
  });

  it("reports false on a network failure", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    const { result } = setup();

    let hasRules: boolean | undefined;
    await act(async () => {
      hasRules = await result.current.hasTimeRules("u1");
    });

    expect(hasRules).toBe(false);
  });

  it("re-asks after a rule is created", async () => {
    fetchMock.mockImplementation(async () => ok([rule()]));
    const { result } = setup();
    await act(async () => {
      await result.current.hasTimeRules("u1");
    });

    fetchMock.mockImplementation(async () => ok(rule({ id: 2 })));
    await act(async () => {
      await result.current.createTimeRule("u1", draft());
    });

    fetchMock.mockClear();
    fetchMock.mockImplementation(async () => ok([rule()]));
    await act(async () => {
      await result.current.hasTimeRules("u1");
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("validateRuleArray", () => {
  it("accepts a set of non-overlapping rules", () => {
    const { result } = setup();

    expect(
      result.current.validateRuleArray([
        draft({ startTime: "08:00", endTime: "10:00" }),
        draft({ startTime: "10:00", endTime: "12:00" }),
      ]),
    ).toEqual({ valid: true, errors: [] });
  });

  it("rejects a rule that ends before it starts", () => {
    const { result } = setup();

    const { valid, errors } = result.current.validateRuleArray([
      draft({ startTime: "22:00", endTime: "20:00" }),
    ]);

    expect(valid).toBe(false);
    expect(errors[0]).toContain("Rule 1: End time must be greater");
  });

  it.each([-1, 7])("rejects day of week %p", (dayOfWeek) => {
    const { result } = setup();

    const { errors } = result.current.validateRuleArray([draft({ dayOfWeek })]);
    expect(errors[0]).toContain("Day of week must be between 0");
  });

  it("rejects two rules that overlap on the same day", () => {
    const { result } = setup();

    const { errors } = result.current.validateRuleArray([
      draft({ startTime: "20:00", endTime: "22:00" }),
      draft({ startTime: "21:00", endTime: "23:00" }),
    ]);

    expect(errors[0]).toBe(
      "Rule 1 overlaps with rule 2 on the same day and time",
    );
  });

  it("allows the same times on different days", () => {
    const { result } = setup();

    expect(
      result.current.validateRuleArray([
        draft({ dayOfWeek: 1 }),
        draft({ dayOfWeek: 2 }),
      ]).valid,
    ).toBe(true);
  });

  it("allows rules that merely touch at the boundary", () => {
    const { result } = setup();

    expect(
      result.current.validateRuleArray([
        draft({ startTime: "08:00", endTime: "10:00" }),
        draft({ startTime: "10:00", endTime: "12:00" }),
      ]).valid,
    ).toBe(true);
  });

  it("reports every problem it finds", () => {
    const { result } = setup();

    const { errors } = result.current.validateRuleArray([
      draft({ dayOfWeek: 9, startTime: "22:00", endTime: "20:00" }),
    ]);

    expect(errors).toHaveLength(2);
  });
});

describe("clearCache", () => {
  it("forgets one user", async () => {
    fetchMock.mockImplementation(async () => ok({ u1: [rule()] }));
    const { result } = setup();
    await act(async () => {
      await result.current.fetchAllTimeRules(["u1"]);
    });

    act(() => result.current.clearCache("u1"));
    fetchMock.mockClear();

    await act(async () => {
      await result.current.fetchAllTimeRules(["u1"]);
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it("forgets every user", async () => {
    fetchMock.mockImplementation(async () => ok({ u1: [rule()], u2: [] }));
    const { result } = setup();
    await act(async () => {
      await result.current.fetchAllTimeRules(["u1", "u2"]);
    });

    act(() => result.current.clearCache());
    fetchMock.mockClear();

    await act(async () => {
      await result.current.fetchAllTimeRules(["u1", "u2"]);
    });

    expect(bodyOf()).toEqual({ userIds: ["u1", "u2"] });
  });
});
