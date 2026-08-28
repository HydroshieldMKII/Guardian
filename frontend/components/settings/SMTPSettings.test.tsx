import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AppSetting } from "@/types";
import { SMTPSettings } from "@/components/settings/SMTPSettings";
import type { SettingsFormData } from "@/components/settings/settings-utils";

const testSmtpConnection = jest.fn();
jest.mock("@/lib/api", () => ({
  apiClient: {
    testSmtpConnection: (...a: unknown[]) => testSmtpConnection(...a),
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

const notificationKeys = [
  "SMTP_ENABLED",
  "SMTP_NOTIFY_ON_NEW_DEVICE",
  "SMTP_NOTIFY_ON_BLOCK",
  "SMTP_NOTIFY_ON_LOCATION_CHANGE",
  "SMTP_NOTIFY_ON_DEVICE_NOTE",
];

const defaultSettings = [
  ...notificationKeys.map((key) => setting(key, "false", "boolean")),
  setting("SMTP_HOST", "mail.example.com"),
  setting("SMTP_PORT", "587"),
  setting("SMTP_PASSWORD", "hunter2"),
  setting("PLEX_SERVER_IP", "10.0.0.5"),
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
    <SMTPSettings
      settings={props.settings ?? defaultSettings}
      formData={props.formData ?? {}}
      onFormDataChange={onFormDataChange}
      hasUnsavedChanges={props.hasUnsavedChanges}
    />,
  );
  return { ...view, onFormDataChange, user: userEvent.setup() };
};

beforeEach(() => {
  jest.clearAllMocks();
  testSmtpConnection.mockResolvedValue({ success: true, message: "Sent" });
});

describe("SMTPSettings", () => {
  it("shows only SMTP settings", () => {
    renderPanel();

    expect(screen.getByDisplayValue("mail.example.com")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("10.0.0.5")).toBeNull();
  });

  it("masks the password field", () => {
    const { container } = renderPanel();
    expect(container.querySelector("#SMTP_PASSWORD")).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("sorts unrecognised SMTP settings last", () => {
    const { container } = renderPanel({
      settings: [
        setting("SMTP_ZZZ", "z"),
        setting("SMTP_HOST", "mail.example.com"),
      ],
    });
    const ids = Array.from(container.querySelectorAll("input")).map(
      (i) => i.id,
    );
    expect(ids[0]).toBe("SMTP_HOST");
  });

  it("reports edits upward", async () => {
    const { user, onFormDataChange } = renderPanel();

    await user.type(screen.getByDisplayValue("587"), "0");

    expect(onFormDataChange).toHaveBeenCalledWith({ SMTP_PORT: "5870" });
  });

  it("prefers a pending edit and stringifies non-strings", () => {
    renderPanel({ formData: { SMTP_PORT: 2525 } });
    expect(screen.getByDisplayValue("2525")).toBeInTheDocument();
  });

  describe("the notification group", () => {
    it("is omitted when a required setting is missing", () => {
      const { container } = renderPanel({
        settings: [setting("SMTP_HOST", "mail.example.com")],
      });
      expect(container.querySelector("#SMTP_ENABLED")).toBeNull();
    });

    it("disables every child switch while SMTP is off", () => {
      const { container } = renderPanel();

      for (const key of notificationKeys.slice(1)) {
        expect(container.querySelector(`#${key}`)).toBeDisabled();
      }
    });

    it.each([["true"], [true]])(
      "enables the children when SMTP is %p",
      (value) => {
        const { container } = renderPanel({
          formData: { SMTP_ENABLED: value as string | boolean },
        });
        expect(
          container.querySelector("#SMTP_NOTIFY_ON_BLOCK"),
        ).not.toBeDisabled();
      },
    );

    it("still renders without the optional device-note switch", () => {
      const { container } = renderPanel({
        settings: [
          ...notificationKeys
            .filter((k) => k !== "SMTP_NOTIFY_ON_DEVICE_NOTE")
            .map((key) => setting(key, "false", "boolean")),
        ],
      });

      expect(container.querySelector("#SMTP_ENABLED")).not.toBeNull();
      expect(container.querySelector("#SMTP_NOTIFY_ON_DEVICE_NOTE")).toBeNull();
    });

    it.each(notificationKeys.slice(1))("toggles %s", async (key) => {
      const { user, onFormDataChange, container } = renderPanel({
        formData: { SMTP_ENABLED: true },
      });

      await user.click(container.querySelector(`#${key}`) as HTMLElement);

      expect(onFormDataChange).toHaveBeenCalledWith({ [key]: true });
    });

    it("toggles SMTP itself", async () => {
      const { user, onFormDataChange, container } = renderPanel();

      await user.click(container.querySelector("#SMTP_ENABLED") as HTMLElement);

      expect(onFormDataChange).toHaveBeenCalledWith({ SMTP_ENABLED: true });
    });

    it.each([["true"], [true]])(
      "reads a stored child value of %p as checked",
      (value) => {
        const { container } = renderPanel({
          formData: {
            SMTP_ENABLED: true,
            SMTP_NOTIFY_ON_BLOCK: value as string | boolean,
          },
        });
        expect(container.querySelector("#SMTP_NOTIFY_ON_BLOCK")).toBeChecked();
      },
    );
  });

  describe("when SMTP is disabled", () => {
    it("offers a disabled test button with an explanation", () => {
      renderPanel();

      expect(
        screen.getByRole("button", { name: /Send Test Email/ }),
      ).toBeDisabled();
      expect(
        screen.getByText("Turn email notifications on to test the connection."),
      ).toBeInTheDocument();
    });

    it("warns about unsaved changes instead", () => {
      renderPanel({ hasUnsavedChanges: true });

      expect(
        screen.getByText("Save your changes before testing the connection."),
      ).toBeInTheDocument();
      expect(
        screen.queryByText(
          "Turn email notifications on to test the connection.",
        ),
      ).toBeNull();
    });

    it("reads the stored value when there is no pending edit", () => {
      renderPanel({
        settings: [
          ...notificationKeys.map((key) =>
            setting(key, key === "SMTP_ENABLED" ? "true" : "false", "boolean"),
          ),
        ],
      });

      expect(
        screen.getByRole("button", { name: /Send Test Email/ }),
      ).toBeInTheDocument();
    });
  });

  describe("sending a test email", () => {
    const enabled = { formData: { SMTP_ENABLED: true } };

    it("reports success", async () => {
      const { user } = renderPanel(enabled);

      await user.click(screen.getByRole("button", { name: /Send Test Email/ }));

      expect(await screen.findByText("Sent")).toBeInTheDocument();
    });

    it("reports the server's failure message", async () => {
      testSmtpConnection.mockResolvedValue({
        success: false,
        message: "Auth rejected",
      });
      const { user } = renderPanel(enabled);

      await user.click(screen.getByRole("button", { name: /Send Test Email/ }));

      expect(await screen.findByText("Auth rejected")).toBeInTheDocument();
    });

    it("falls back when the server gives no message", async () => {
      testSmtpConnection.mockResolvedValue({ success: false });
      const { user } = renderPanel(enabled);

      await user.click(screen.getByRole("button", { name: /Send Test Email/ }));

      expect(await screen.findByText("SMTP test failed")).toBeInTheDocument();
    });

    it("reports a thrown error", async () => {
      testSmtpConnection.mockRejectedValue(new Error("offline"));
      const { user } = renderPanel(enabled);

      await user.click(screen.getByRole("button", { name: /Send Test Email/ }));

      expect(await screen.findByText("offline")).toBeInTheDocument();
    });

    it("falls back for a non-Error rejection", async () => {
      testSmtpConnection.mockRejectedValue("boom");
      const { user } = renderPanel(enabled);

      await user.click(screen.getByRole("button", { name: /Send Test Email/ }));

      expect(
        await screen.findByText("Failed to test SMTP connection"),
      ).toBeInTheDocument();
    });

    it("is blocked while there are unsaved changes", () => {
      renderPanel({ ...enabled, hasUnsavedChanges: true });

      expect(
        screen.getByRole("button", { name: /Send Test Email/ }),
      ).toBeDisabled();
      expect(
        screen.getByText("Save your changes before testing the connection."),
      ).toBeInTheDocument();
    });

    it("shows progress while sending", async () => {
      testSmtpConnection.mockReturnValue(new Promise(() => {}));
      const { user } = renderPanel(enabled);

      await user.click(screen.getByRole("button", { name: /Send Test Email/ }));

      expect(screen.getByText("Sending...")).toBeInTheDocument();
    });
  });
});

describe("SMTPSettings clearing a stored secret", () => {
  const withPrivatePassword = [
    ...notificationKeys.map((key) => setting(key, "false", "boolean")),
    setting("SMTP_HOST", "mail.example.com"),
    { ...setting("SMTP_PASSWORD", "hunter2"), private: true } as AppSetting,
  ];

  it("masks the stored password instead of echoing it", () => {
    renderPanel({ settings: withPrivatePassword });

    expect(screen.getByPlaceholderText("•••••••• (saved)")).toHaveValue("");
  });

  it("empties the password when the clear button is pressed", async () => {
    const { user, onFormDataChange } = renderPanel({
      settings: withPrivatePassword,
    });

    await user.click(
      screen.getByRole("button", { name: "Clear SMTP_PASSWORD" }),
    );

    expect(onFormDataChange).toHaveBeenCalledWith({ SMTP_PASSWORD: "" });
  });

  it("drops the clear button once the password is empty", () => {
    renderPanel({
      settings: withPrivatePassword,
      formData: { SMTP_PASSWORD: "" },
    });

    expect(
      screen.queryByRole("button", { name: "Clear SMTP_PASSWORD" }),
    ).toBeNull();
    expect(
      screen.getByPlaceholderText("Enter smtp password"),
    ).toBeInTheDocument();
  });
});
