import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AppSetting } from "@/types";
import { PlexSettings } from "@/components/settings/PlexSettings";
import type { SettingsFormData } from "@/components/settings/settings-utils";

const testPlexConnection = jest.fn();
jest.mock("@/lib/api", () => ({
  apiClient: {
    testPlexConnection: (...a: unknown[]) => testPlexConnection(...a),
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

const defaultSettings = [
  setting("PLEX_SERVER_IP", "10.0.0.5"),
  setting("PLEX_SERVER_PORT", "32400"),
  setting("PLEX_TOKEN", "secret-token"),
  setting("USE_SSL", "false", "boolean"),
  setting("IGNORE_CERT_ERRORS", "false", "boolean"),
  setting("CUSTOM_PLEX_URL", ""),
  setting("PLEX_GUARD_DEFAULT_BLOCK", "true", "boolean"),
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
    <PlexSettings
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
  testPlexConnection.mockResolvedValue({ success: true, message: "Connected" });
});

describe("PlexSettings", () => {
  it("shows only Plex-related settings", () => {
    renderPanel();

    expect(screen.getByDisplayValue("10.0.0.5")).toBeInTheDocument();
    expect(screen.getByDisplayValue("32400")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("mail.example.com")).toBeNull();
  });

  it("puts Custom Plex URL last", () => {
    const { container } = renderPanel();
    const ids = Array.from(container.querySelectorAll("input")).map(
      (input) => input.id,
    );

    expect(ids[ids.length - 1]).toBe("CUSTOM_PLEX_URL");
  });

  describe("the optional marker", () => {
    it("marks Custom Plex URL as optional", () => {
      renderPanel();

      expect(screen.getByText("Optional")).toBeInTheDocument();
    });

    it("leaves a required setting unadorned", () => {
      renderPanel({ settings: [setting("PLEX_SERVER_IP", "10.0.0.5")] });

      expect(screen.queryByText("Optional")).toBeNull();
    });
  });

  it("sorts unrecognised Plex settings to the end", () => {
    const { container } = renderPanel({
      settings: [
        setting("PLEX_UNKNOWN_ONE", "a"),
        setting("PLEX_SERVER_IP", "10.0.0.5"),
        setting("PLEX_UNKNOWN_TWO", "b"),
      ],
    });
    const ids = Array.from(container.querySelectorAll("input")).map(
      (input) => input.id,
    );

    expect(ids[0]).toBe("PLEX_SERVER_IP");
    expect(ids).toHaveLength(3);
  });

  it("excludes the default-block setting despite its prefix", () => {
    const { container } = renderPanel();
    expect(container.querySelector("#PLEX_GUARD_DEFAULT_BLOCK")).toBeNull();
  });

  it("masks the token field", () => {
    const { container } = renderPanel();
    expect(container.querySelector("#PLEX_TOKEN")).toHaveAttribute(
      "type",
      "password",
    );
  });

  it("leaves ordinary fields as text", () => {
    const { container } = renderPanel();
    expect(container.querySelector("#PLEX_SERVER_IP")).toHaveAttribute(
      "type",
      "text",
    );
  });

  it("reports edits upward", async () => {
    const { user, onFormDataChange } = renderPanel();

    await user.type(screen.getByDisplayValue("10.0.0.5"), "0");

    expect(onFormDataChange).toHaveBeenCalledWith({
      PLEX_SERVER_IP: "10.0.0.50",
    });
  });

  it("prefers a pending edit over the stored value", () => {
    renderPanel({ formData: { PLEX_SERVER_IP: "192.168.1.1" } });
    expect(screen.getByDisplayValue("192.168.1.1")).toBeInTheDocument();
  });

  it("renders a non-string pending value", () => {
    renderPanel({ formData: { PLEX_SERVER_PORT: 1234 } });
    expect(screen.getByDisplayValue("1234")).toBeInTheDocument();
  });

  describe("the SSL group", () => {
    it("is omitted when either setting is missing", () => {
      const { container } = renderPanel({
        settings: [setting("PLEX_SERVER_IP", "10.0.0.5")],
      });
      expect(container.querySelector("#USE_SSL")).toBeNull();
    });

    it("disables the cert switch while SSL is off", () => {
      const { container } = renderPanel();
      expect(container.querySelector("#IGNORE_CERT_ERRORS")).toBeDisabled();
    });

    it.each([["true"], [true]])(
      "enables the cert switch when SSL is %p",
      (value) => {
        const { container } = renderPanel({
          formData: { USE_SSL: value as string | boolean },
        });
        expect(
          container.querySelector("#IGNORE_CERT_ERRORS"),
        ).not.toBeDisabled();
      },
    );

    it("toggles SSL", async () => {
      const { user, onFormDataChange, container } = renderPanel();

      await user.click(container.querySelector("#USE_SSL") as HTMLElement);

      expect(onFormDataChange).toHaveBeenCalledWith({ USE_SSL: true });
    });

    it("toggles cert errors once SSL is on", async () => {
      const { user, onFormDataChange, container } = renderPanel({
        formData: { USE_SSL: true },
      });

      await user.click(
        container.querySelector("#IGNORE_CERT_ERRORS") as HTMLElement,
      );

      expect(onFormDataChange).toHaveBeenCalledWith({
        IGNORE_CERT_ERRORS: true,
      });
    });

    it.each([["true"], [true]])(
      "reads a stored cert value of %p as checked",
      (value) => {
        const { container } = renderPanel({
          formData: {
            USE_SSL: true,
            IGNORE_CERT_ERRORS: value as string | boolean,
          },
        });
        expect(container.querySelector("#IGNORE_CERT_ERRORS")).toBeChecked();
      },
    );
  });

  describe("testing the connection", () => {
    it("reports success", async () => {
      const { user } = renderPanel();

      await user.click(
        screen.getByRole("button", { name: /Test Plex Connection/ }),
      );

      expect(await screen.findByText("Connected")).toBeInTheDocument();
    });

    it("reports the server's failure message", async () => {
      testPlexConnection.mockResolvedValue({
        success: false,
        message: "Token rejected",
      });
      const { user } = renderPanel();

      await user.click(
        screen.getByRole("button", { name: /Test Plex Connection/ }),
      );

      expect(await screen.findByText("Token rejected")).toBeInTheDocument();
    });

    it("falls back when the server gives no message", async () => {
      testPlexConnection.mockResolvedValue({ success: false });
      const { user } = renderPanel();

      await user.click(
        screen.getByRole("button", { name: /Test Plex Connection/ }),
      );

      expect(await screen.findByText("Connection failed")).toBeInTheDocument();
    });

    it("reports a thrown error", async () => {
      testPlexConnection.mockRejectedValue(new Error("offline"));
      const { user } = renderPanel();

      await user.click(
        screen.getByRole("button", { name: /Test Plex Connection/ }),
      );

      expect(await screen.findByText("offline")).toBeInTheDocument();
    });

    it("falls back for a non-Error rejection", async () => {
      testPlexConnection.mockRejectedValue("boom");
      const { user } = renderPanel();

      await user.click(
        screen.getByRole("button", { name: /Test Plex Connection/ }),
      );

      expect(
        await screen.findByText("Failed to test connection"),
      ).toBeInTheDocument();
    });

    it("is blocked while there are unsaved changes", () => {
      renderPanel({ hasUnsavedChanges: true });

      expect(
        screen.getByRole("button", { name: /Test Plex Connection/ }),
      ).toBeDisabled();
      expect(
        screen.getByText("Save your changes before testing the connection."),
      ).toBeInTheDocument();
    });

    it("hides a stale result once changes are made", async () => {
      const { user, rerender } = renderPanel();

      await user.click(
        screen.getByRole("button", { name: /Test Plex Connection/ }),
      );
      expect(await screen.findByText("Connected")).toBeInTheDocument();

      rerender(
        <PlexSettings
          settings={defaultSettings}
          formData={{}}
          onFormDataChange={jest.fn()}
          hasUnsavedChanges
        />,
      );

      expect(screen.queryByText("Connected")).toBeNull();
    });

    it("clears the result when changes are saved", async () => {
      const { user, rerender } = renderPanel({ hasUnsavedChanges: true });

      rerender(
        <PlexSettings
          settings={defaultSettings}
          formData={{}}
          onFormDataChange={jest.fn()}
          hasUnsavedChanges={false}
        />,
      );

      await user.click(
        screen.getByRole("button", { name: /Test Plex Connection/ }),
      );
      expect(await screen.findByText("Connected")).toBeInTheDocument();
    });

    it("shows progress while testing", async () => {
      let resolve: (value: unknown) => void = () => {};
      testPlexConnection.mockReturnValue(
        new Promise((r) => {
          resolve = r;
        }),
      );
      const { user } = renderPanel();

      await user.click(
        screen.getByRole("button", { name: /Test Plex Connection/ }),
      );
      expect(screen.getByText("Testing...")).toBeInTheDocument();

      await waitFor(async () => {
        resolve({ success: true, message: "Connected" });
      });
      expect(await screen.findByText("Connected")).toBeInTheDocument();
    });
  });
});

describe("PlexSettings clearing a stored token", () => {
  const withPrivateToken = [
    setting("PLEX_SERVER_IP", "10.0.0.5"),
    { ...setting("PLEX_TOKEN", "secret-token"), private: true } as AppSetting,
  ];

  it("masks the stored token instead of echoing it", () => {
    renderPanel({ settings: withPrivateToken });

    expect(screen.getByPlaceholderText("•••••••• (saved)")).toHaveValue("");
  });

  it("empties the token when the clear button is pressed", async () => {
    const { user, onFormDataChange } = renderPanel({
      settings: withPrivateToken,
    });

    await user.click(screen.getByRole("button", { name: "Clear PLEX_TOKEN" }));

    expect(onFormDataChange).toHaveBeenCalledWith({ PLEX_TOKEN: "" });
  });
});
