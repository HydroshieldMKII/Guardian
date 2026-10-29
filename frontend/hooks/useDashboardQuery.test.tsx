import { waitFor } from "@testing-library/react";
import { useDashboardQuery } from "@/hooks/useDashboardQuery";
import { createQueryClient } from "@/lib/query-client";
import { queryKeys } from "@/lib/query-keys";
import { dashboardData } from "@/test-utils/dashboard";
import { renderHookWithQuery } from "@/test-utils/query";
import type { UnifiedDashboardData } from "@/types";

const getDashboardData = jest.fn<Promise<UnifiedDashboardData>, unknown[]>();
jest.mock("@/lib/api", () => ({
  apiClient: {
    getDashboardData: (...args: unknown[]) => getDashboardData(...args),
  },
}));

const useLiveDashboard = jest.fn<{ connected: boolean }, [unknown, boolean]>(
  () => ({ connected: false }),
);
jest.mock("@/hooks/useLiveDashboard", () => ({
  useLiveDashboard: (onUpdate: unknown, enabled: boolean) =>
    useLiveDashboard(onUpdate, enabled),
}));

beforeEach(() => {
  jest.clearAllMocks();
  getDashboardData.mockResolvedValue(dashboardData());
});

describe("useDashboardQuery", () => {
  it("loads the dashboard and listens for pushed updates", async () => {
    const { result } = renderHookWithQuery(() => useDashboardQuery(true));

    await waitFor(() => expect(result.current.data).toEqual(dashboardData()));
    expect(getDashboardData).toHaveBeenCalledTimes(1);
    expect(useLiveDashboard).toHaveBeenLastCalledWith(
      expect.any(Function),
      true,
    );
  });

  it("reads what another screen already loaded without fetching or listening", () => {
    const client = createQueryClient();
    const cached = dashboardData({
      stats: {
        activeStreams: 3,
        totalDevices: 0,
        pendingDevices: 0,
        approvedDevices: 0,
      },
    });
    client.setQueryData(queryKeys.dashboard, cached);

    const { result } = renderHookWithQuery(
      () => useDashboardQuery(false),
      client,
    );

    expect(result.current.data).toEqual(cached);
    expect(getDashboardData).not.toHaveBeenCalled();
    expect(useLiveDashboard).toHaveBeenLastCalledWith(
      expect.any(Function),
      false,
    );
  });
});
