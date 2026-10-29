import { act, renderHook } from "@testing-library/react";
import { useTimeRuleBulkActions } from "./useTimeRuleBulkActions";
import { feedbackMock, timeRule } from "@/test-utils/time-rules";
import type { TimeRulePreset } from "@/lib/time-rules-api";
import type { UserTimeRule } from "@/types";

const deleteTimeRules = jest.fn<Promise<unknown>, [number[]]>();
const applyPreset = jest.fn<Promise<unknown>, [TimeRulePreset]>();
const feedback = feedbackMock();

const setup = (rules: UserTimeRule[] = [timeRule()]) =>
  renderHook(() =>
    useTimeRuleBulkActions({ rules, deleteTimeRules, applyPreset, feedback }),
  );

beforeEach(() => {
  jest.clearAllMocks();
  deleteTimeRules.mockResolvedValue(undefined);
  applyPreset.mockResolvedValue(undefined);
});

describe("useTimeRuleBulkActions", () => {
  it("asks nothing when there are no rules to delete", () => {
    const { result } = setup([]);

    act(() => result.current.requestDeleteAll());

    expect(result.current.confirmingDeleteAll).toBe(false);
  });

  it("deletes every rule once confirmed", async () => {
    const { result } = setup();
    act(() => result.current.requestDeleteAll());
    expect(result.current.confirmingDeleteAll).toBe(true);

    await act(() => result.current.deleteAll());

    expect(deleteTimeRules).toHaveBeenCalledWith([1]);
    expect(feedback.succeed).toHaveBeenCalledWith(
      "Time schedule cleared",
      "Deleted 1 rule. This user can now stream at any time.",
    );
    expect(result.current.confirmingDeleteAll).toBe(false);
  });

  it("can abandon deleting every rule", () => {
    const { result } = setup();
    act(() => result.current.requestDeleteAll());

    act(() => result.current.cancelDeleteAll());

    expect(result.current.confirmingDeleteAll).toBe(false);
  });

  it("applies nothing without a chosen preset", async () => {
    const { result } = setup();

    await act(() => result.current.confirmPreset());

    expect(applyPreset).not.toHaveBeenCalled();
  });

  it("applies the chosen preset", async () => {
    const { result } = setup();
    act(() => result.current.choosePreset("weekends-only"));

    await act(() => result.current.confirmPreset());

    expect(applyPreset).toHaveBeenCalledWith("weekends-only");
    expect(feedback.succeed).toHaveBeenCalledWith(
      "Preset applied",
      "Streaming is now blocked all day from Monday to Friday",
    );
    expect(result.current.presetToConfirm).toBeNull();
  });

  it("ignores a second preset while one is being applied", async () => {
    let finish = () => {};
    applyPreset.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = setup();
    act(() => result.current.choosePreset("weekdays-only"));
    let pending = Promise.resolve();
    act(() => {
      pending = result.current.confirmPreset();
    });

    await act(() => result.current.confirmPreset());
    expect(applyPreset).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish();
      await pending;
    });
    expect(result.current.applyingPreset).toBeNull();
  });
});
