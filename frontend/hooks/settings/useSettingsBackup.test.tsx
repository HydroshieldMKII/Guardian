import { act, renderHook } from "@testing-library/react";
import { useSettingsBackup } from "@/hooks/settings/useSettingsBackup";

const importDatabase = jest.fn<Promise<void>, [FormData]>();
jest.mock("@/lib/api", () => ({
  apiClient: {
    importDatabase: (data: FormData) => importDatabase(data),
  },
}));
jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));
jest.mock("@/hooks/useVersionInfo", () => ({
  useVersionInfo: () => ({ versionInfo: null }),
}));

describe("useSettingsBackup", () => {
  it("imports nothing when no file is waiting on a version check", () => {
    const { result } = renderHook(() => useSettingsBackup());

    act(() => result.current.proceedWithImport());

    expect(importDatabase).not.toHaveBeenCalled();
    expect(result.current.importing).toBe(false);
  });
});
