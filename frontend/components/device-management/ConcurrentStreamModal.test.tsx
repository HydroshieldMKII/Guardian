import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConcurrentStreamModal } from "@/components/device-management/ConcurrentStreamModal";

const getUserConcurrentStreamInfo = jest.fn();
const updateUserConcurrentStreamLimit = jest.fn();

jest.mock("@/lib/api", () => ({
  apiClient: {
    getUserConcurrentStreamInfo: (...args: unknown[]) =>
      getUserConcurrentStreamInfo(...args),
    updateUserConcurrentStreamLimit: (...args: unknown[]) =>
      updateUserConcurrentStreamLimit(...args),
  },
}));

const toast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast }),
}));

let settings: { key: string; value: string }[] = [];
jest.mock("@/contexts/settings-context", () => ({
  useSettings: () => ({ settings }),
}));

let consoleError: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  settings = [{ key: "CONCURRENT_STREAM_LIMIT", value: "3" }];
  getUserConcurrentStreamInfo.mockResolvedValue({
    limit: null,
    effectiveLimit: 3,
    isUnlimited: false,
    isOverridden: false,
  });
  updateUserConcurrentStreamLimit.mockResolvedValue(undefined);
});

afterEach(() => {
  consoleError.mockRestore();
});

const renderModal = async (
  props: { isOpen?: boolean; username?: string } = {},
) => {
  const onClose = jest.fn();
  const onUpdate = jest.fn();
  const view = render(
    <ConcurrentStreamModal
      isOpen={props.isOpen ?? true}
      onClose={onClose}
      userId="u-1"
      username={props.username}
      onUpdate={onUpdate}
    />,
  );
  if (props.isOpen ?? true) {
    await screen.findByText("Use global default");
  }
  return { ...view, onClose, onUpdate, user: userEvent.setup() };
};

describe("ConcurrentStreamModal", () => {
  it("stays closed and fetches nothing", () => {
    render(
      <ConcurrentStreamModal
        isOpen={false}
        onClose={jest.fn()}
        userId="u-1"
      />,
    );

    expect(screen.queryByText("Concurrent Stream Limit")).toBeNull();
    expect(getUserConcurrentStreamInfo).not.toHaveBeenCalled();
  });

  it("names the user, falling back to the id", async () => {
    await renderModal({ username: "testuser" });
    expect(screen.getByText("testuser")).toBeInTheDocument();
  });

  it("falls back to the user id without a username", async () => {
    await renderModal();
    expect(screen.getByText("u-1")).toBeInTheDocument();
  });

  it("shows a spinner while fetching", async () => {
    let resolve: (value: unknown) => void = () => {};
    getUserConcurrentStreamInfo.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );

    render(
      <ConcurrentStreamModal isOpen onClose={jest.fn()} userId="u-1" />,
    );
    expect(screen.queryByText("Use global default")).toBeNull();

    await act(async () => {
      resolve({ limit: null, isOverridden: false });
    });
    expect(screen.getByText("Use global default")).toBeInTheDocument();
  });

  describe("the global limit", () => {
    it("reports the configured value", async () => {
      await renderModal();
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("reports zero as unlimited", async () => {
      settings = [{ key: "CONCURRENT_STREAM_LIMIT", value: "0" }];
      await renderModal();
      expect(screen.getAllByText("Unlimited").length).toBeGreaterThan(0);
    });

    it("treats a missing setting as unlimited", async () => {
      settings = [];
      await renderModal();
      expect(screen.getAllByText("Unlimited").length).toBeGreaterThan(0);
    });
  });

  describe("seeding from the server", () => {
    it("uses the global default when the user has no override", async () => {
      await renderModal();

      expect(screen.getByRole("switch")).toBeChecked();
      expect(screen.getByLabelText(/Custom limit/)).toBeDisabled();
      expect(
        screen.getByText("3 concurrent streams"),
      ).toBeInTheDocument();
    });

    it("uses the stored override when the user has one", async () => {
      getUserConcurrentStreamInfo.mockResolvedValue({
        limit: 5,
        isOverridden: true,
      });
      await renderModal();

      expect(screen.getByRole("switch")).not.toBeChecked();
      expect(screen.getByLabelText(/Custom limit/)).toHaveValue(5);
      expect(screen.getByText("5 concurrent streams")).toBeInTheDocument();
    });

    it("treats an override with a null limit as zero", async () => {
      getUserConcurrentStreamInfo.mockResolvedValue({
        limit: null,
        isOverridden: true,
      });
      await renderModal();

      expect(screen.getByLabelText(/Custom limit/)).toHaveValue(0);
    });

    it("falls back to the global default when the fetch fails", async () => {
      getUserConcurrentStreamInfo.mockRejectedValue(new Error("nope"));
      await renderModal();

      expect(screen.getByRole("switch")).toBeChecked();
      expect(consoleError).toHaveBeenCalledWith(
        "Failed to fetch concurrent stream info:",
        expect.any(Error),
      );
    });
  });

  describe("the effective limit summary", () => {
    it("says unlimited for zero", async () => {
      getUserConcurrentStreamInfo.mockResolvedValue({
        limit: 0,
        isOverridden: true,
      });
      await renderModal();

      expect(screen.getAllByText("Unlimited").length).toBeGreaterThan(0);
    });

    it("uses the singular for one", async () => {
      getUserConcurrentStreamInfo.mockResolvedValue({
        limit: 1,
        isOverridden: true,
      });
      await renderModal();

      expect(screen.getByText("1 concurrent stream")).toBeInTheDocument();
    });
  });

  describe("saving", () => {
    it("clears the override when using the global default", async () => {
      const { user, onClose, onUpdate } = await renderModal();

      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() =>
        expect(updateUserConcurrentStreamLimit).toHaveBeenCalledWith(
          "u-1",
          null,
        ),
      );
      expect(onUpdate).toHaveBeenCalledWith({ concurrentStreamLimit: null });
      expect(onClose).toHaveBeenCalled();
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });

    it("sends the custom limit once the toggle is off", async () => {
      const { user } = await renderModal();

      await user.click(screen.getByRole("switch"));
      await user.clear(screen.getByLabelText(/Custom limit/));
      await user.type(screen.getByLabelText(/Custom limit/), "4");
      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() =>
        expect(updateUserConcurrentStreamLimit).toHaveBeenCalledWith("u-1", 4),
      );
    });

    it("reports a failure without closing", async () => {
      updateUserConcurrentStreamLimit.mockRejectedValue(
        new Error("server said no"),
      );
      const { user, onClose } = await renderModal();

      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: "destructive",
            description: "server said no",
          }),
        ),
      );
      expect(onClose).not.toHaveBeenCalled();
    });

    it("falls back to a generic message for a non-Error rejection", async () => {
      updateUserConcurrentStreamLimit.mockRejectedValue("boom");
      const { user } = await renderModal();

      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            description: "Failed to update concurrent stream limit",
          }),
        ),
      );
    });

    it("works without an onUpdate callback", async () => {
      const user = userEvent.setup();
      render(
        <ConcurrentStreamModal isOpen onClose={jest.fn()} userId="u-1" />,
      );
      await screen.findByText("Use global default");

      await user.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() =>
        expect(updateUserConcurrentStreamLimit).toHaveBeenCalled(),
      );
    });

    it("closes on cancel without saving", async () => {
      const { user, onClose } = await renderModal();

      await user.click(screen.getByRole("button", { name: "Cancel" }));

      expect(onClose).toHaveBeenCalled();
      expect(updateUserConcurrentStreamLimit).not.toHaveBeenCalled();
    });
  });
});
