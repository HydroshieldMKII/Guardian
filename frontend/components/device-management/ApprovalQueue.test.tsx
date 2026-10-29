import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserDevice } from "@/types";
import {
  ApprovalQueue,
  type QueueItem,
} from "@/components/device-management/ApprovalQueue";
import type { UserDeviceGroup } from "@/components/device-management/user-group";

const device = (overrides: Partial<UserDevice> = {}): UserDevice => ({
  id: 1,
  userId: "u-1",
  deviceIdentifier: "device-1",
  deviceName: "TV",
  deviceProduct: "Plex Web",
  devicePlatform: "Chrome",
  approved: false,
  status: "pending",
  firstSeen: "2026-01-01T00:00:00Z",
  lastSeen: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  sessionCount: 1,
  ...overrides,
});

const group = (overrides: Partial<UserDeviceGroup> = {}): UserDeviceGroup => ({
  user: { userId: "u-1", username: "alex" },
  devices: [],
  pendingCount: 1,
  approvedCount: 0,
  rejectedCount: 0,
  ...overrides,
});

const item = (overrides: Partial<UserDevice> = {}): QueueItem => ({
  device: device(overrides),
  group: group(),
});

const many = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    item({ id: i + 1, deviceName: `Device ${i + 1}` }),
  );

const renderQueue = (
  overrides: Partial<React.ComponentProps<typeof ApprovalQueue>> = {},
) => {
  const props = {
    items: [item()],
    actionLoading: null,
    onApprove: jest.fn(),
    onReject: jest.fn(),
    onOpenDevice: jest.fn(),
    ...overrides,
  };
  const view = render(<ApprovalQueue {...props} />);
  return { ...view, props, user: userEvent.setup({ pointerEventsCheck: 0 }) };
};

describe("ApprovalQueue empty state", () => {
  it("says nothing is waiting and points at the user list", () => {
    const { container } = renderQueue({ items: [] });

    expect(
      screen.getByRole("heading", { name: "Nothing waiting for approval" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Pick a user to see their devices and rules\./),
    ).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("lg:py-20");
  });

  it("stays short and drops the hint on small screens", () => {
    const { container } = renderQueue({ items: [] });

    expect(screen.getByText(/Pick a user/)).toHaveClass("hidden", "lg:inline");
    expect(container.firstChild).toHaveClass("py-6");
  });
});

describe("ApprovalQueue", () => {
  it("heads the list without repeating the count", () => {
    renderQueue({ items: many(2) });

    expect(
      screen.getByRole("heading", { name: "Waiting for approval" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("2")).toBeNull();
  });

  it("describes each device", () => {
    renderQueue();

    expect(screen.getByText("TV")).toBeInTheDocument();
    expect(
      screen.getByText("alex, Plex Web on Chrome, seen 2 hours ago"),
    ).toBeInTheDocument();
  });

  it.each([
    [{ devicePlatform: undefined }, "alex, Plex Web, seen 2 hours ago"],
    [
      { deviceProduct: undefined, devicePlatform: undefined },
      "alex, Unknown device, seen 2 hours ago",
    ],
  ])("falls back for missing device facts %#", (overrides, text) => {
    renderQueue({ items: [item(overrides)] });

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("names unnamed devices and users by fallback", () => {
    renderQueue({
      items: [
        {
          device: device({ deviceName: "" }),
          group: group({ user: { userId: "u-7" } }),
        },
      ],
    });

    expect(screen.getByText("Unknown")).toBeInTheDocument();
    expect(screen.getByTitle("Show in u-7")).toBeInTheDocument();
  });

  it("opens the device in its user", async () => {
    const { user, props } = renderQueue();

    await user.click(screen.getByTitle("Show in alex"));

    expect(props.onOpenDevice).toHaveBeenCalledWith("u-1", "device-1");
  });

  it("approves and rejects the device", async () => {
    const { user, props } = renderQueue();

    await user.click(screen.getByRole("button", { name: "Approve" }));
    await user.click(screen.getByRole("button", { name: "Reject" }));

    expect(props.onApprove).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
    );
    expect(props.onReject).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
    );
  });

  it("disables only the busy device", () => {
    renderQueue({ items: many(2), actionLoading: 2 });

    const approve = screen.getAllByRole("button", { name: "Approve" });
    const reject = screen.getAllByRole("button", { name: "Reject" });
    expect(approve[0]).toBeEnabled();
    expect(reject[0]).toBeEnabled();
    expect(approve[1]).toBeDisabled();
    expect(reject[1]).toBeDisabled();
  });

  it("flags an unread note", () => {
    renderQueue({
      items: [
        item({
          requestDescription: "Hotel TV",
          requestSubmittedAt: "2026-01-01T00:00:00Z",
        }),
      ],
    });

    expect(
      screen.getByLabelText("Has a note from the user"),
    ).toBeInTheDocument();
  });

  it.each([
    [{}],
    [{ requestDescription: "Hotel TV" }],
    [
      {
        requestDescription: "Hotel TV",
        requestSubmittedAt: "2026-01-01T00:00:00Z",
        requestNoteReadAt: "2026-01-02T00:00:00Z",
      },
    ],
  ])("shows no note flag without an unread note %#", (overrides) => {
    renderQueue({ items: [item(overrides)] });

    expect(screen.queryByLabelText("Has a note from the user")).toBeNull();
  });
});

const folded = () =>
  screen
    .getAllByRole("listitem")
    .filter((listItem) => listItem.classList.contains("hidden"));

describe("ApprovalQueue on small screens", () => {
  it("keeps every device in the list for wide screens", () => {
    renderQueue({ items: many(5) });

    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(folded()).toHaveLength(2);
    folded().forEach((listItem) => expect(listItem).toHaveClass("lg:flex"));
  });

  it("folds nothing and needs no toggle at the limit", () => {
    renderQueue({ items: many(3) });

    expect(folded()).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Show all/ })).toBeNull();
  });

  it("expands and collapses past the limit", async () => {
    const { user } = renderQueue({ items: many(5) });

    const toggle = screen.getByRole("button", { name: "Show all 5" });
    expect(toggle).toHaveClass("lg:hidden");
    expect(folded().map((listItem) => listItem.textContent)).toEqual([
      expect.stringContaining("Device 4"),
      expect.stringContaining("Device 5"),
    ]);

    await user.click(toggle);
    expect(folded()).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Show fewer" }));
    expect(folded()).toHaveLength(2);
  });
});
