import { act, renderHook } from "@testing-library/react";
import { useTimeRuleEditing } from "./useTimeRuleEditing";
import { feedbackMock, timeRule } from "@/test-utils/time-rules";
import type { UserTimeRule } from "@/types";

const updateTimeRule = jest.fn<Promise<unknown>, [number, object]>();
const deleteTimeRule = jest.fn<Promise<unknown>, [number]>();
const feedback = feedbackMock();
const rules = [
  timeRule(),
  timeRule({
    id: 2,
    ruleName: "Evenings",
    startTime: "18:00",
    endTime: "22:00",
  }),
];

const setup = (current: UserTimeRule[] = rules) =>
  renderHook(() =>
    useTimeRuleEditing({
      rules: current,
      updateTimeRule,
      deleteTimeRule,
      feedback,
    }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  updateTimeRule.mockResolvedValue(undefined);
  deleteTimeRule.mockResolvedValue(undefined);
});

describe("useTimeRuleEditing", () => {
  it("does not edit a rule it cannot find", () => {
    const { result } = setup();

    act(() => result.current.startEdit(99));

    expect(result.current.edit).toBeNull();
  });

  it("only changes the draft of the rule being edited", () => {
    const { result } = setup();
    act(() => result.current.startEdit(1));

    act(() => result.current.changeDraft(2, { ruleName: "Other" }));
    expect(result.current.edit?.draft.ruleName).toBe("School hours");

    act(() => result.current.changeDraft(1, { ruleName: "Mornings" }));
    expect(result.current.edit?.draft.ruleName).toBe("Mornings");
  });

  it("saves nothing for a rule that is not being edited", async () => {
    const { result } = setup();
    act(() => result.current.startEdit(1));

    await act(() => result.current.saveEdit(2));

    expect(updateTimeRule).not.toHaveBeenCalled();
  });

  it("saves nothing for a rule that has gone", async () => {
    const { result, rerender } = renderHook(
      ({ current }) =>
        useTimeRuleEditing({
          rules: current,
          updateTimeRule,
          deleteTimeRule,
          feedback,
        }),
      { initialProps: { current: rules } },
    );
    act(() => result.current.startEdit(1));
    rerender({ current: [] });

    await act(() => result.current.saveEdit(1));

    expect(updateTimeRule).not.toHaveBeenCalled();
  });

  it("keeps the rule's own values for a cleared draft", async () => {
    const { result } = setup();
    act(() => result.current.startEdit(1));
    act(() =>
      result.current.changeDraft(1, {
        ruleName: "",
        startTime: "",
        endTime: "",
      }),
    );

    await act(() => result.current.saveEdit(1));

    expect(updateTimeRule).toHaveBeenCalledWith(1, {
      ruleName: "School hours",
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "15:00",
      enabled: true,
    });
    expect(result.current.edit).toBeNull();
    expect(feedback.succeed).toHaveBeenCalledWith(
      "Rule updated",
      "The rule has been updated",
    );
  });

  it("refuses an edit that overlaps another rule", async () => {
    const { result } = setup();
    act(() => result.current.startEdit(1));
    act(() => result.current.changeDraft(1, { endTime: "19:00" }));

    await act(() => result.current.saveEdit(1));

    expect(feedback.conflict).toHaveBeenCalledWith(rules[1]);
    expect(updateTimeRule).not.toHaveBeenCalled();
  });

  it("keeps the edit open when saving fails", async () => {
    const failure = new Error("Server down");
    updateTimeRule.mockRejectedValue(failure);
    const { result } = setup();
    act(() => result.current.startEdit(1));

    await act(() => result.current.saveEdit(1));

    expect(feedback.fail).toHaveBeenCalledWith(
      failure,
      "Failed to update rule",
    );
    expect(result.current.edit?.ruleId).toBe(1);
    expect(result.current.updatingRuleId).toBeNull();
  });

  it("toggles a rule", async () => {
    const { result } = setup();

    await act(() => result.current.toggleEnabled(2, false));

    expect(updateTimeRule).toHaveBeenCalledWith(2, { enabled: false });
    expect(feedback.succeed).not.toHaveBeenCalled();
  });

  it("deletes a rule", async () => {
    const { result } = setup();

    await act(() => result.current.deleteRule(2));

    expect(deleteTimeRule).toHaveBeenCalledWith(2);
    expect(result.current.deletingRuleId).toBeNull();
  });
});
