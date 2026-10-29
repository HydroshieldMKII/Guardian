import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PortalDeviceRow } from "@/components/portal/PortalDeviceRow";
import { portalDevice } from "@/test-utils/portal";
import type { PortalDevice } from "@/types";

const renderRow = (device: PortalDevice, canAddNote = false) => {
  const onAddNote = jest.fn<void, [PortalDevice]>();
  render(
    <ul>
      <PortalDeviceRow
        device={device}
        canAddNote={canAddNote}
        onAddNote={onAddNote}
      />
    </ul>,
  );
  return { onAddNote, user: userEvent.setup() };
};

describe("PortalDeviceRow", () => {
  it("names the device, its app and platform", () => {
    renderRow(portalDevice());

    expect(screen.getByText("Living Room TV")).toBeInTheDocument();
    expect(
      screen.getByText("Plex for Android · Android TV"),
    ).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add note/ })).toBeNull();
  });

  it("offers a note when allowed", async () => {
    const device = portalDevice();
    const { onAddNote, user } = renderRow(device, true);

    await user.click(screen.getByRole("button", { name: /Add note/ }));

    expect(onAddNote).toHaveBeenCalledWith(device);
  });

  it("shows a note the owner has not read yet", () => {
    renderRow(
      portalDevice({
        requestDescription: "My new TV",
        requestSubmittedAt: "2026-01-01T10:00:00Z",
      }),
    );

    expect(screen.getByText("My new TV")).toBeInTheDocument();
    expect(screen.getByText("Not read yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        `Submitted ${new Date("2026-01-01T10:00:00Z").toLocaleString()}`,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Read on/)).toBeNull();
  });

  it("shows when the owner read the note", () => {
    renderRow(
      portalDevice({
        requestDescription: "My new TV",
        requestSubmittedAt: "2026-01-01T10:00:00Z",
        requestNoteReadAt: "2026-01-02T10:00:00Z",
      }),
    );

    expect(screen.getByText("Read")).toBeInTheDocument();
    expect(
      screen.getByText(
        `Read on ${new Date("2026-01-02T10:00:00Z").toLocaleString()}`,
      ),
    ).toBeInTheDocument();
  });

  it("lists the device schedule", () => {
    renderRow(
      portalDevice({
        rules: {
          timeRules: [
            {
              id: 1,
              dayOfWeek: 2,
              startTime: "20:00",
              endTime: "21:00",
              ruleName: "",
              enabled: true,
            },
          ],
        },
      }),
    );

    expect(screen.getByText("Schedule for this device")).toBeInTheDocument();
    expect(screen.getByText("Tuesday")).toBeInTheDocument();
  });

  it("leaves out an empty schedule", () => {
    renderRow(portalDevice({ rules: { timeRules: [] } }));
    expect(screen.queryByText("Schedule for this device")).toBeNull();
  });
});
