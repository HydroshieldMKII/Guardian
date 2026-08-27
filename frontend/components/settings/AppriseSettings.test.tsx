import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AppSetting } from "@/types";
import { AppriseSettings } from "@/components/settings/AppriseSettings";
import type { SettingsFormData } from "@/components/settings/settings-utils";

const testAppriseConnection = jest.fn();
jest.mock("@/lib/api", () => ({
  apiClient: {
    testAppriseConnection: (...a: unknown[]) => testAppriseConnection(...a),
  },
}));
jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

const setting = (
  key: string,
  value: string,
  type: string = "string",
): AppSetting => ({ key, value, type }) as AppSetting;

const childKeys = [
  "APPRISE_NOTIFY_ON_NEW_DEVICE",
  "APPRISE_NOTIFY_ON_BLOCK",
  "APPRISE_NOTIFY_ON_LOCATION_CHANGE",
  "APPRISE_NOTIFY_ON_DEVICE_NOTE",
];

const defaultSettings = [
  setting("APPRISE_ENABLED", "false", "boolean"),
  ...childKeys.map((key) => setting(key, "false", "boolean")),
  setting("APPRISE_URLS", "discord://abc"),
  setting("SMTP_HOST", "mail.example.com"),
];

const renderPanel = (
  props: {
    settings?: AppSetting[];
    formData?: SettingsFormData;
    hasUnsavedChanges?: boolean;
  } = {},
) => {
  const onFormDataChange = jest.fn();
  const view = render(
    <AppriseSettings
      settings={props.settings ?? defaultSettings}
      formData={props.formData ?? {}}
      onFormDataChange={onFormDataChange}
      hasUnsavedChanges={props.hasUnsavedChanges}
    />,
  );
  return { ...view, onFormDataChange, user: userEvent.setup() };
};

const enabled = { formData: { APPRISE_ENABLED: "true" } };

beforeEach(() => {
  jest.clearAllMocks();
  testAppriseConnection.mockResolvedValue({ success: true, message: "Sent" });
});

describe("AppriseSettings", () => {
  it("shows only Apprise settings", () => {
    renderPanel();

    expect(screen.getByDisplayValue("discord://abc")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("mail.example.com")).toBeNull();
  });

  it("skips malformed settings entries", () => {
    renderPanel({
      settings: [
        null as unknown as AppSetting,
        { value: "x" } as AppSetting,
        setting("APPRISE_ENABLED", "false", "boolean"),
      ],
    });

    expect(screen.getAllByRole("switch")).toHaveLength(1);
  });

  it("sorts unrecognised Apprise settings last", () => {
    renderPanel({
      settings: [
        setting("APPRISE_ZZZ", "z"),
        setting("APPRISE_ENABLED", "false", "boolean"),
      ],
    });
    expect(screen.getAllByRole("switch")).toHaveLength(1);
  });

  it("links to the Apprise documentation", () => {
    renderPanel();

    const link = screen.getByRole("link", {
      name: /See the Apprise documentation/,
    });

    expect(link).toHaveAttribute(
      "href",
      "https://github.com/caronc/apprise/wiki",
    );
    expect(link).toHaveAttribute("target", "_blank");
  });

  describe("the enable switch", () => {
    it("turns Apprise on", async () => {
      const { user, onFormDataChange } = renderPanel();

      await user.click(screen.getAllByRole("switch")[0]);

      expect(onFormDataChange).toHaveBeenCalledWith({
        APPRISE_ENABLED: "true",
      });
    });

    it("disables the children and the URL box while off", () => {
      renderPanel();

      for (const child of screen.getAllByRole("switch").slice(1)) {
        expect(child).toBeDisabled();
      }
      expect(screen.getByDisplayValue("discord://abc")).toBeDisabled();
    });

    it("enables them once on", () => {
      renderPanel(enabled);

      for (const child of screen.getAllByRole("switch").slice(1)) {
        expect(child).not.toBeDisabled();
      }
      expect(screen.getByDisplayValue("discord://abc")).not.toBeDisabled();
    });
  });

  it.each(childKeys)("toggles %s", async (key) => {
    const { user, onFormDataChange } = renderPanel(enabled);
    const index = childKeys.indexOf(key) + 1;

    await user.click(screen.getAllByRole("switch")[index]);

    expect(onFormDataChange).toHaveBeenCalledWith({ [key]: "true" });
  });

  it("edits the URL list", async () => {
    const { user, onFormDataChange } = renderPanel(enabled);

    await user.type(screen.getByDisplayValue("discord://abc"), "d");

    expect(onFormDataChange).toHaveBeenCalledWith({
      APPRISE_URLS: "discord://abcd",
    });
  });

  describe("when disabled", () => {
    it("offers a disabled test button with an explanation", () => {
      renderPanel();

      expect(
        screen.getByRole("button", { name: /Send Test Notification/ }),
      ).toBeDisabled();
      expect(
        screen.getByText("Turn Apprise on to test the connection."),
      ).toBeInTheDocument();
    });

    it("warns about unsaved changes instead", () => {
      renderPanel({ hasUnsavedChanges: true });

      expect(
        screen.queryByText("Turn Apprise on to test the connection."),
      ).toBeNull();
    });
  });

  describe("sending a test notification", () => {
    it("reports success", async () => {
      const { user } = renderPanel(enabled);

      await user.click(
        screen.getByRole("button", { name: /Send Test Notification/ }),
      );

      expect(await screen.findByText("Sent")).toBeInTheDocument();
    });

    it("reports the server's failure message", async () => {
      testAppriseConnection.mockResolvedValue({
        success: false,
        message: "No URLs configured",
      });
      const { user } = renderPanel(enabled);

      await user.click(
        screen.getByRole("button", { name: /Send Test Notification/ }),
      );

      expect(await screen.findByText("No URLs configured")).toBeInTheDocument();
    });

    it("falls back when the server gives no message", async () => {
      testAppriseConnection.mockResolvedValue({ success: false });
      const { user } = renderPanel(enabled);

      await user.click(
        screen.getByRole("button", { name: /Send Test Notification/ }),
      );

      expect(
        await screen.findByText("Apprise test failed"),
      ).toBeInTheDocument();
    });

    it("reports a thrown error", async () => {
      testAppriseConnection.mockRejectedValue(new Error("offline"));
      const { user } = renderPanel(enabled);

      await user.click(
        screen.getByRole("button", { name: /Send Test Notification/ }),
      );

      expect(await screen.findByText("offline")).toBeInTheDocument();
    });

    it("falls back for a non-Error rejection", async () => {
      testAppriseConnection.mockRejectedValue("boom");
      const { user } = renderPanel(enabled);

      await user.click(
        screen.getByRole("button", { name: /Send Test Notification/ }),
      );

      expect(
        await screen.findByText("Failed to test Apprise connection"),
      ).toBeInTheDocument();
    });

    it("is blocked while there are unsaved changes", () => {
      renderPanel({ ...enabled, hasUnsavedChanges: true });

      expect(
        screen.getByRole("button", { name: /Send Test Notification/ }),
      ).toBeDisabled();
    });

    it("shows progress while sending", async () => {
      testAppriseConnection.mockReturnValue(new Promise(() => {}));
      const { user, container } = renderPanel(enabled);

      await user.click(
        screen.getByRole("button", { name: /Send Test Notification/ }),
      );

      expect(container.querySelector(".animate-spin")).not.toBeNull();
    });

    it("clears a stale result once changes are made", async () => {
      const { user, rerender } = renderPanel(enabled);

      await user.click(
        screen.getByRole("button", { name: /Send Test Notification/ }),
      );
      expect(await screen.findByText("Sent")).toBeInTheDocument();

      rerender(
        <AppriseSettings
          settings={defaultSettings}
          formData={{ APPRISE_ENABLED: "true" }}
          onFormDataChange={jest.fn()}
          hasUnsavedChanges
        />,
      );

      expect(screen.queryByText("Sent")).toBeNull();
    });
  });
});
