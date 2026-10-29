import type { TimeRuleFeedback } from "@/hooks/device-management/useTimeRuleFeedback";
import type { UserTimeRule } from "@/types";

export const timeRule = (
  overrides: Partial<UserTimeRule> = {},
): UserTimeRule => ({
  id: 1,
  userId: "u-1",
  ruleName: "School hours",
  enabled: true,
  dayOfWeek: 1,
  startTime: "09:00",
  endTime: "15:00",
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

export const feedbackMock = (): jest.Mocked<TimeRuleFeedback> => ({
  succeed: jest.fn(),
  warn: jest.fn(),
  fail: jest.fn(),
  conflict: jest.fn(),
});
