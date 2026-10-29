import { act, renderHook } from "@testing-library/react";
import { useNewTimeRule } from "./useNewTimeRule";
import { feedbackMock, timeRule } from "@/test-utils/time-rules";
import type { CreateTimeRuleDto } from "@/types";

const createTimeRule = jest.fn<Promise<unknown>, [CreateTimeRuleDto]>();
const feedback = feedbackMock();

const setup = (deviceIdentifier?: string) =>
  renderHook(() =>
    useNewTimeRule({
      rules: [timeRule()],
      deviceIdentifier,
      createTimeRule,
      feedback,
    }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  createTimeRule.mockResolvedValue(undefined);
});

describe("useNewTimeRule", () => {
  it("asks for a name", async () => {
    const { result } = setup();
    act(() => result.current.change({ ruleName: "   " }));

    await act(() => result.current.create());

    expect(feedback.warn).toHaveBeenCalledWith("Enter a name for this rule");
    expect(createTimeRule).not.toHaveBeenCalled();
  });

  it("refuses a rule that overlaps an existing one", async () => {
    const { result } = setup();
    act(() => result.current.change({ ruleName: "Lunch", dayOfWeek: 1 }));

    await act(() => result.current.create());

    expect(feedback.conflict).toHaveBeenCalledWith(timeRule());
    expect(createTimeRule).not.toHaveBeenCalled();
  });

  it("creates the rule and resets the form for the same device", async () => {
    const { result } = setup("device-1");
    act(() => result.current.change({ ruleName: "Evenings" }));

    await act(() => result.current.create());

    expect(createTimeRule).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleName: "Evenings",
        deviceIdentifier: "device-1",
      }),
    );
    expect(result.current.rule.ruleName).toBe("");
    expect(result.current.rule.deviceIdentifier).toBe("device-1");
    expect(result.current.creating).toBe(false);
  });

  it("keeps the form when creating fails", async () => {
    const failure = new Error("Server down");
    createTimeRule.mockRejectedValue(failure);
    const { result } = setup();
    act(() => result.current.change({ ruleName: "Evenings" }));

    await act(() => result.current.create());

    expect(feedback.fail).toHaveBeenCalledWith(
      failure,
      "Failed to create rule",
    );
    expect(result.current.rule.ruleName).toBe("Evenings");
  });
});
