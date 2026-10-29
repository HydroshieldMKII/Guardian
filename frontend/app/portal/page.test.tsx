import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UserPortalPage from "@/app/portal/page";
import type { User } from "@/contexts/auth-context";
import { portalDevice, portalRules } from "@/test-utils/portal";
import { renderWithQuery } from "@/test-utils/query";
import type { PortalDevice, PortalSettings, PortalUserRules } from "@/types";

const render = renderWithQuery;

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt, src }: { alt: string; src: string }) => (
    <img alt={alt} src={src} />
  ),
}));

jest.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: jest.fn() }),
}));

const toast = jest.fn<void, [unknown]>();
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

const viewer: User = { plexUserId: "plex-1", plexUsername: "viewer" };
let auth: { user: User | null; isLoading: boolean };
jest.mock("@/contexts/auth-context", () => ({
  ...jest.requireActual<typeof import("@/contexts/auth-context")>(
    "@/contexts/auth-context",
  ),
  useAuth: () => ({ ...auth, logout: jest.fn() }),
}));

const api = {
  devices: jest.fn<Promise<PortalDevice[]>, []>(),
  settings: jest.fn<Promise<PortalSettings>, []>(),
  rules: jest.fn<Promise<PortalUserRules | null>, []>(),
  sendNote: jest.fn<Promise<void>, [number, string]>(),
};
jest.mock("@/lib/portal-api", () => ({
  portalApi: {
    devices: () => api.devices(),
    settings: () => api.settings(),
    rules: () => api.rules(),
    sendNote: (deviceId: number, description: string) =>
      api.sendNote(deviceId, description),
  },
}));

const tv = portalDevice();
const phone = portalDevice({
  id: 2,
  deviceName: "Phone",
  devicePlatform: "iOS",
  deviceProduct: "Plex for iOS",
});

const renderPortal = async () => {
  render(<UserPortalPage />);
  await screen.findByRole("heading", { name: "My devices" });
  return userEvent.setup();
};

const rowOf = (name: string) =>
  screen.getByText(name).closest("li") as HTMLElement;

beforeEach(() => {
  jest.clearAllMocks();
  auth = { user: viewer, isLoading: false };
  api.devices.mockResolvedValue([tv, phone]);
  api.settings.mockResolvedValue({
    showRules: false,
    allowRejectedRequests: false,
  });
  api.rules.mockResolvedValue(portalRules());
  api.sendNote.mockResolvedValue(undefined);
});

describe("UserPortalPage", () => {
  it("waits for the session before loading anything", () => {
    auth = { user: null, isLoading: true };
    render(<UserPortalPage />);

    expect(screen.queryByRole("heading", { name: "My devices" })).toBeNull();
    expect(api.devices).not.toHaveBeenCalled();
  });

  it("lists the user's devices", async () => {
    await renderPortal();

    expect(screen.getByText("Living Room TV")).toBeInTheDocument();
    expect(screen.getByText("Phone")).toBeInTheDocument();
    expect(screen.queryByText("Your rules")).toBeNull();
  });

  it("explains an empty device list", async () => {
    api.devices.mockResolvedValue([]);
    await renderPortal();

    expect(screen.getByText("No devices yet")).toBeInTheDocument();
  });

  it("shows the rules the owner shares", async () => {
    api.settings.mockResolvedValue({
      showRules: true,
      allowRejectedRequests: false,
    });
    await renderPortal();

    expect(await screen.findByText("Your rules")).toBeInTheDocument();
  });

  it("offers a note only where one can be added", async () => {
    api.devices.mockResolvedValue([
      tv,
      portalDevice({ id: 3, deviceName: "Laptop", status: "approved" }),
    ]);
    await renderPortal();

    expect(
      within(rowOf("Living Room TV")).getByRole("button", { name: /Add note/ }),
    ).toBeInTheDocument();
    expect(
      within(rowOf("Laptop")).queryByRole("button", { name: /Add note/ }),
    ).toBeNull();
  });

  it("sends a note and reloads the devices", async () => {
    const user = await renderPortal();

    await user.click(
      within(rowOf("Living Room TV")).getByRole("button", { name: /Add note/ }),
    );
    await user.type(screen.getByLabelText(/^Note/), "Please approve");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Submit note" }));

    expect(api.sendNote).toHaveBeenCalledWith(1, "Please approve");
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Note submitted" }),
      ),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(api.devices).toHaveBeenCalledTimes(2));
  });

  it("keeps the note open when sending fails", async () => {
    api.sendNote.mockRejectedValue(new Error("Note already submitted"));
    const user = await renderPortal();

    await user.click(
      within(rowOf("Living Room TV")).getByRole("button", { name: /Add note/ }),
    );
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Submit note" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Note already submitted" }),
      ),
    );
    expect(
      screen.getByRole("dialog", { name: "Confirm submission" }),
    ).toBeInTheDocument();
  });

  it("starts a fresh note for each device", async () => {
    const user = await renderPortal();

    await user.click(
      within(rowOf("Living Room TV")).getByRole("button", { name: /Add note/ }),
    );
    await user.type(screen.getByLabelText(/^Note/), "Draft");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(
      within(rowOf("Phone")).getByRole("button", { name: /Add note/ }),
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Plex for iOS · iOS")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Note/)).toHaveValue("");
  });

  it("reloads on refresh", async () => {
    const user = await renderPortal();

    await user.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => expect(api.devices).toHaveBeenCalledTimes(2));
    expect(api.settings).toHaveBeenCalledTimes(2);
  });
});
