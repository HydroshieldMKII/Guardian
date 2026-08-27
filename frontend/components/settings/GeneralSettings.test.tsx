import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AppSetting } from "@/types";
import { GeneralSettings } from "@/components/settings/GeneralSettings";
import type { SettingsFormData } from "@/components/settings/settings-utils";

const auth = {
  user: { id: "a-1", username: "owner", email: "owner@example.com" } as {
    id: string;
    username: string;
    email: string;
  } | null,
};

jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => auth,
  isAdminUser: (user: unknown) =>
    user !== null && typeof user === "object" && "username" in user,
}));

const setting = (
  key: string,
  value: string,
  type: string = "string",
): AppSetting => ({ key, value, type }) as AppSetting;

const guardianSettings = [
  setting("PLEX_GUARD_DEFAULT_BLOCK", "true", "boolean"),
  setting("PLEX_GUARD_STRICT_MODE", "false", "boolean"),
  setting("PLEXGUARD_REFRESH_INTERVAL", "5"),
  setting("AUTO_CHECK_UPDATES", "true", "boolean"),
  setting("CLOUDFLARE_TURNSTILE_SITE_KEY", "site-key"),
  setting("CLOUDFLARE_TURNSTILE_SECRET_KEY", "secret-key"),
  setting("CONCURRENT_STREAM_LIMIT", "3"),
  setting("CONCURRENT_LIMIT_INCLUDE_TEMP_ACCESS", "false", "boolean"),
  setting("DEVICE_CLEANUP_ENABLED", "true", "boolean"),
  setting("DEVICE_CLEANUP_INTERVAL_DAYS", "30"),
  setting("TIMEZONE", "+00:00"),
  setting("USER_PORTAL_ENABLED", "true", "boolean"),
  setting("USER_PORTAL_SHOW_RULES", "false", "boolean"),
  setting("USER_PORTAL_ALLOW_REJECTED_REQUESTS", "false", "boolean"),
];

const customizationSettings = [
  setting("DEFAULT_PAGE", "devices"),
  setting("ENABLE_MEDIA_THUMBNAILS", "true", "boolean"),
  setting("ENABLE_MEDIA_ARTWORK", "false", "boolean"),
  setting("MSG_BLOCKED", "You are blocked"),
];

const notificationSettings = [
  setting("IN_APP_ENABLED", "true", "boolean"),
  setting("AUTO_MARK_NOTIFICATION_READ", "false", "boolean"),
  setting("IN_APP_NOTIFY_ON_NEW_DEVICE", "false", "boolean"),
  setting("IN_APP_NOTIFY_ON_BLOCK", "false", "boolean"),
  setting("IN_APP_NOTIFY_ON_LOCATION_CHANGE", "false", "boolean"),
  setting("IN_APP_NOTIFY_ON_DEVICE_NOTE", "false", "boolean"),
];

const renderPanel = (
  sectionId: string,
  props: { settings?: AppSetting[]; formData?: SettingsFormData } = {},
) => {
  const onFormDataChange = jest.fn();
  const fallback =
    sectionId === "customization"
      ? customizationSettings
      : sectionId === "notifications"
        ? notificationSettings
        : guardianSettings;
  const view = render(
    <GeneralSettings
      settings={props.settings ?? fallback}
      formData={props.formData ?? {}}
      onFormDataChange={onFormDataChange}
      sectionId={sectionId}
    />,
  );
  return { ...view, onFormDataChange, user: userEvent.setup() };
};

const fetchMock = jest.fn();
let consoleError: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  auth.user = { id: "a-1", username: "owner", email: "owner@example.com" };
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      enabled: false,
      emailConfigured: false,
      appUrlConfigured: true,
    }),
  });
  Object.defineProperty(global, "fetch", {
    value: fetchMock,
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("GeneralSettings sections", () => {
  it.each([
    [
      "guardian",
      [
        "Access Control",
        "Monitoring & Maintenance",
        "User Portal",
        "Login Security",
      ],
    ],
    ["customization", ["Interface", "User-Facing Messages"]],
    ["notifications", ["In-App Notifications"]],
  ])("groups the %s settings into cards", (sectionId, titles) => {
    renderPanel(sectionId);
    for (const title of titles) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }
  });

  it("drops a card whose settings are all missing", () => {
    renderPanel("guardian", {
      settings: guardianSettings.filter(
        (s) => !s.key.startsWith("CLOUDFLARE_"),
      ),
    });

    expect(screen.queryByText("Login Security")).toBeNull();
    expect(screen.getByText("Access Control")).toBeInTheDocument();
  });

  it("renders nothing for an unknown section", () => {
    const { container } = renderPanel("nonsense");
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when the section has no settings", () => {
    const { container } = renderPanel("guardian", { settings: [] });
    expect(container).toBeEmptyDOMElement();
  });

  it("keeps settings out of the wrong section", () => {
    const { container } = renderPanel("guardian", {
      settings: [...guardianSettings, setting("MSG_BLOCKED", "hi")],
    });
    expect(container.querySelector("#MSG_BLOCKED")).toBeNull();
  });

  it("includes every MSG_ setting in customization", () => {
    const { container } = renderPanel("customization");
    expect(container.querySelector("#MSG_BLOCKED")).not.toBeNull();
  });

  it("sorts unrecognised settings to the end", () => {
    const { container } = renderPanel("customization", {
      settings: [setting("MSG_ZZZ", "z"), setting("DEFAULT_PAGE", "devices")],
    });
    expect(container.querySelector("#MSG_ZZZ")).not.toBeNull();
  });
});

describe("GeneralSettings inputs", () => {
  it("renders a plain text field", async () => {
    const { user, onFormDataChange } = renderPanel("customization");

    await user.type(screen.getByDisplayValue("You are blocked"), "!");

    expect(onFormDataChange).toHaveBeenCalledWith({
      MSG_BLOCKED: "You are blocked!",
    });
  });

  it("renders interval fields as numbers", () => {
    const { container } = renderPanel("guardian");
    expect(
      container.querySelector("#PLEXGUARD_REFRESH_INTERVAL"),
    ).toHaveAttribute("type", "number");
  });

  it("stringifies a non-string pending value", () => {
    renderPanel("guardian", { formData: { PLEXGUARD_REFRESH_INTERVAL: 9 } });
    expect(screen.getByDisplayValue("9")).toBeInTheDocument();
  });

  it("toggles a boolean setting", async () => {
    const { user, onFormDataChange, container } = renderPanel("guardian");

    await user.click(
      container.querySelector("#PLEX_GUARD_STRICT_MODE") as HTMLElement,
    );

    expect(onFormDataChange).toHaveBeenCalledWith({
      PLEX_GUARD_STRICT_MODE: true,
    });
  });

  describe("the Turnstile keys", () => {
    it("masks the secret and links to Cloudflare from the site key", () => {
      const { container } = renderPanel("guardian");

      expect(
        container.querySelector("#CLOUDFLARE_TURNSTILE_SECRET_KEY"),
      ).toHaveAttribute("type", "password");
      expect(
        container.querySelector("#CLOUDFLARE_TURNSTILE_SITE_KEY"),
      ).toHaveAttribute("type", "text");
      expect(
        screen.getByRole("link", { name: "Cloudflare Turnstile" }),
      ).toHaveAttribute(
        "href",
        "https://dash.cloudflare.com/sign-up?to=/:account/turnstile",
      );
    });

    it("reports edits", async () => {
      const { user, onFormDataChange } = renderPanel("guardian");

      await user.type(screen.getByDisplayValue("site-key"), "1");

      expect(onFormDataChange).toHaveBeenCalledWith({
        CLOUDFLARE_TURNSTILE_SITE_KEY: "site-key1",
      });
    });
  });

  describe("the default page picker", () => {
    it.each([
      ["Devices", "devices"],
      ["Streams", "streams"],
    ])("selects %s", async (label, expected) => {
      const { user, onFormDataChange } = renderPanel("customization");

      await user.click(screen.getByRole("button", { name: label }));

      expect(onFormDataChange).toHaveBeenCalledWith({
        DEFAULT_PAGE: expected,
      });
    });

    it("marks the current choice", () => {
      renderPanel("customization", { formData: { DEFAULT_PAGE: "streams" } });
      expect(screen.getByRole("button", { name: "Streams" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      expect(screen.getByRole("button", { name: "Devices" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
    });

    it("sits on the same row as its label", () => {
      renderPanel("customization");

      const label = screen.getByText("Default dashboard page");
      const control = screen.getByRole("button", { name: "Devices" });

      expect(label.parentElement).toContainElement(control);
    });
  });

  describe("the timezone picker", () => {
    it("offers every UTC offset with a live clock", async () => {
      const { user } = renderPanel("guardian");

      await user.click(screen.getByRole("combobox"));

      expect(
        (await screen.findAllByText(/^UTC[+-]\d\d:\d\d - /)).length,
      ).toBeGreaterThan(20);
    });

    it("reports the chosen offset", async () => {
      const { user, onFormDataChange } = renderPanel("guardian");

      await user.click(screen.getByRole("combobox"));
      await user.click(await screen.findByText(/^UTC\+05:00/));

      expect(onFormDataChange).toHaveBeenCalledWith({ TIMEZONE: "+05:00" });
    });
  });
});

describe("GeneralSettings device cleanup group", () => {
  it("disables the interval while cleanup is off", () => {
    const { container } = renderPanel("guardian", {
      formData: { DEVICE_CLEANUP_ENABLED: false },
    });
    expect(
      container.querySelector("#DEVICE_CLEANUP_INTERVAL_DAYS"),
    ).toBeDisabled();
  });

  it("also accepts the string form of off", () => {
    const { container } = renderPanel("guardian", {
      formData: { DEVICE_CLEANUP_ENABLED: "false" },
    });
    expect(
      container.querySelector("#DEVICE_CLEANUP_INTERVAL_DAYS"),
    ).toBeDisabled();
  });

  it("enables the interval while cleanup is on", () => {
    const { container } = renderPanel("guardian", {
      formData: { DEVICE_CLEANUP_ENABLED: true },
    });
    expect(
      container.querySelector("#DEVICE_CLEANUP_INTERVAL_DAYS"),
    ).not.toBeDisabled();
  });

  it("edits the interval", async () => {
    const { user, onFormDataChange } = renderPanel("guardian", {
      formData: { DEVICE_CLEANUP_ENABLED: true },
    });

    await user.type(screen.getByDisplayValue("30"), "1");

    expect(onFormDataChange).toHaveBeenCalledWith({
      DEVICE_CLEANUP_INTERVAL_DAYS: "301",
    });
  });

  it("stringifies a non-string interval", () => {
    renderPanel("guardian", {
      formData: {
        DEVICE_CLEANUP_ENABLED: true,
        DEVICE_CLEANUP_INTERVAL_DAYS: 7,
      },
    });
    expect(screen.getByDisplayValue("7")).toBeInTheDocument();
  });

  it("toggles cleanup itself", async () => {
    const { user, onFormDataChange, container } = renderPanel("guardian");

    await user.click(
      container.querySelector("#DEVICE_CLEANUP_ENABLED") as HTMLElement,
    );

    expect(onFormDataChange).toHaveBeenCalled();
  });

  it("omits the group when a member is missing", () => {
    const { container } = renderPanel("guardian", {
      settings: guardianSettings.filter(
        (s) => s.key !== "DEVICE_CLEANUP_INTERVAL_DAYS",
      ),
    });
    expect(container.querySelector("#DEVICE_CLEANUP_INTERVAL_DAYS")).toBeNull();
  });
});

describe("GeneralSettings concurrent stream group", () => {
  it("edits the limit", async () => {
    const { user, onFormDataChange } = renderPanel("guardian");

    await user.type(screen.getByDisplayValue("3"), "0");

    expect(onFormDataChange).toHaveBeenCalledWith({
      CONCURRENT_STREAM_LIMIT: "30",
    });
  });

  it("toggles whether temporary access counts", async () => {
    const { user, onFormDataChange, container } = renderPanel("guardian");

    await user.click(
      container.querySelector(
        "#CONCURRENT_LIMIT_INCLUDE_TEMP_ACCESS",
      ) as HTMLElement,
    );

    expect(onFormDataChange).toHaveBeenCalled();
  });

  it("renders without the optional temp-access switch", () => {
    const { container } = renderPanel("guardian", {
      settings: guardianSettings.filter(
        (s) => s.key !== "CONCURRENT_LIMIT_INCLUDE_TEMP_ACCESS",
      ),
    });

    expect(
      container.querySelector("#CONCURRENT_LIMIT_INCLUDE_TEMP_ACCESS"),
    ).toBeNull();
    expect(screen.getByDisplayValue("3")).toBeInTheDocument();
  });

  it("dims the temp-access switch when the limit is unlimited", () => {
    const { container } = renderPanel("guardian", {
      formData: { CONCURRENT_STREAM_LIMIT: "0" },
    });

    expect(container.innerHTML).toContain("opacity-50");
  });

  it("stringifies a numeric limit", () => {
    renderPanel("guardian", { formData: { CONCURRENT_STREAM_LIMIT: 12 } });
    expect(screen.getByDisplayValue("12")).toBeInTheDocument();
  });

  it("omits the group when the limit is missing", () => {
    renderPanel("guardian", {
      settings: guardianSettings.filter(
        (s) => s.key !== "CONCURRENT_STREAM_LIMIT",
      ),
    });
    expect(screen.queryByDisplayValue("3")).toBeNull();
  });
});

describe("GeneralSettings user portal group", () => {
  it("disables the children while the portal is off", () => {
    const { container } = renderPanel("guardian", {
      formData: { USER_PORTAL_ENABLED: false },
    });

    expect(container.querySelector("#USER_PORTAL_SHOW_RULES")).toBeDisabled();
    expect(
      container.querySelector("#USER_PORTAL_ALLOW_REJECTED_REQUESTS"),
    ).toBeDisabled();
  });

  it("enables them while the portal is on", () => {
    const { container } = renderPanel("guardian", {
      formData: { USER_PORTAL_ENABLED: true },
    });

    expect(
      container.querySelector("#USER_PORTAL_SHOW_RULES"),
    ).not.toBeDisabled();
  });

  it("renders without the portal toggle itself", () => {
    const { container } = renderPanel("guardian", {
      settings: guardianSettings.filter((s) => s.key !== "USER_PORTAL_ENABLED"),
    });

    expect(container.querySelector("#USER_PORTAL_ENABLED")).toBeNull();
    expect(screen.getByText("Access Control")).toBeInTheDocument();
  });

  it("stringifies a numeric timezone value", () => {
    renderPanel("guardian", { formData: { TIMEZONE: "+05:00" } });
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("stringifies a numeric default page value", () => {
    renderPanel("customization", { formData: { DEFAULT_PAGE: 1 } });
    expect(screen.getByRole("button", { name: "Devices" })).toBeInTheDocument();
  });

  it("stringifies a numeric Turnstile key", () => {
    renderPanel("guardian", {
      formData: { CLOUDFLARE_TURNSTILE_SITE_KEY: 123 },
    });
    expect(screen.getByDisplayValue("123")).toBeInTheDocument();
  });

  it("renders with only some portal settings present", () => {
    const { container } = renderPanel("guardian", {
      settings: guardianSettings.filter(
        (s) => s.key !== "USER_PORTAL_SHOW_RULES",
      ),
    });

    expect(container.querySelector("#USER_PORTAL_ENABLED")).not.toBeNull();
    expect(container.querySelector("#USER_PORTAL_SHOW_RULES")).toBeNull();
  });

  it("omits the group when every portal setting is missing", () => {
    const { container } = renderPanel("guardian", {
      settings: guardianSettings.filter(
        (s) => !s.key.startsWith("USER_PORTAL_"),
      ),
    });

    expect(container.querySelector("#USER_PORTAL_ENABLED")).toBeNull();
  });

  it("toggles the portal itself", async () => {
    const { user, onFormDataChange, container } = renderPanel("guardian");

    await user.click(
      container.querySelector("#USER_PORTAL_ENABLED") as HTMLElement,
    );

    expect(onFormDataChange).toHaveBeenCalled();
  });
});

describe("GeneralSettings notification group", () => {
  it("disables the children while in-app notifications are off", () => {
    const { container } = renderPanel("notifications", {
      formData: { IN_APP_ENABLED: false },
    });

    expect(
      container.querySelector("#IN_APP_NOTIFY_ON_NEW_DEVICE"),
    ).toBeDisabled();
  });

  it("enables them while on", () => {
    const { container } = renderPanel("notifications", {
      formData: { IN_APP_ENABLED: true },
    });

    expect(
      container.querySelector("#IN_APP_NOTIFY_ON_NEW_DEVICE"),
    ).not.toBeDisabled();
  });

  it.each([
    "IN_APP_NOTIFY_ON_NEW_DEVICE",
    "IN_APP_NOTIFY_ON_BLOCK",
    "IN_APP_NOTIFY_ON_LOCATION_CHANGE",
    "IN_APP_NOTIFY_ON_DEVICE_NOTE",
    "AUTO_MARK_NOTIFICATION_READ",
  ])("toggles %s", async (key) => {
    const { user, onFormDataChange, container } = renderPanel("notifications", {
      formData: { IN_APP_ENABLED: true },
    });

    await user.click(container.querySelector(`#${key}`) as HTMLElement);

    expect(onFormDataChange).toHaveBeenCalledWith({ [key]: true });
  });

  it("toggles in-app notifications themselves", async () => {
    const { user, onFormDataChange, container } = renderPanel("notifications");

    await user.click(container.querySelector("#IN_APP_ENABLED") as HTMLElement);

    expect(onFormDataChange).toHaveBeenCalled();
  });

  it("omits the group when in-app notifications are missing", () => {
    const { container } = renderPanel("notifications", {
      settings: notificationSettings.filter((s) => s.key !== "IN_APP_ENABLED"),
    });
    expect(container.querySelector("#IN_APP_ENABLED")).toBeNull();
  });
});

describe("GeneralSettings clearing the Turnstile secret", () => {
  const withPrivateSecret = [
    setting("CLOUDFLARE_TURNSTILE_SITE_KEY", "site-key"),
    {
      ...setting("CLOUDFLARE_TURNSTILE_SECRET_KEY", "secret-key"),
      private: true,
    } as AppSetting,
  ];

  it("masks the stored secret instead of echoing it", () => {
    renderPanel("guardian", { settings: withPrivateSecret });

    expect(screen.getByPlaceholderText("•••••••• (saved)")).toHaveValue("");
  });

  it("empties the secret when the clear button is pressed", async () => {
    const { user, onFormDataChange } = renderPanel("guardian", {
      settings: withPrivateSecret,
    });

    await user.click(
      screen.getByRole("button", {
        name: "Clear CLOUDFLARE_TURNSTILE_SECRET_KEY",
      }),
    );

    expect(onFormDataChange).toHaveBeenCalledWith({
      CLOUDFLARE_TURNSTILE_SECRET_KEY: "",
    });
  });
});

describe("GeneralSettings password reset", () => {
  const smtp = (overrides: Partial<Record<string, string>> = {}) => [
    ...guardianSettings,
    setting("PASSWORD_RESET_ENABLED", "false", "boolean"),
    setting("SMTP_ENABLED", overrides.SMTP_ENABLED ?? "true", "boolean"),
    setting("SMTP_HOST", overrides.SMTP_HOST ?? "smtp.example.com"),
    setting("SMTP_FROM_EMAIL", overrides.SMTP_FROM_EMAIL ?? "a@example.com"),
  ];

  const toggle = () =>
    screen.getByRole("switch", { name: /Allow password reset by email/ });

  const renderReset = async (
    props: { settings?: AppSetting[]; formData?: SettingsFormData } = {},
  ) => {
    const view = renderPanel("guardian", {
      settings: props.settings ?? smtp(),
      formData: props.formData,
    });
    await act(async () => {});
    return view;
  };

  const unmet = () =>
    screen.queryAllByRole("listitem").map((item) => item.textContent);

  it("offers the toggle once email is configured", async () => {
    await renderReset();

    expect(toggle()).not.toBeDisabled();
    expect(screen.queryByText(/need the following first/)).toBeNull();
  });

  it("greys the toggle out while SMTP is off", async () => {
    await renderReset({ settings: smtp({ SMTP_ENABLED: "false" }) });

    expect(toggle()).toBeDisabled();
    expect(unmet()).toEqual([
      "Configure and enable a mail server under Email settings",
    ]);
  });

  it.each(["SMTP_HOST", "SMTP_FROM_EMAIL"])(
    "greys the toggle out without %s",
    async (key) => {
      await renderReset({ settings: smtp({ [key]: "" }) });

      expect(toggle()).toBeDisabled();
    },
  );

  it("reads unsaved SMTP edits, not just the stored values", async () => {
    await renderReset({
      settings: smtp({ SMTP_ENABLED: "false" }),
      formData: { SMTP_ENABLED: true },
    });

    expect(toggle()).not.toBeDisabled();
  });

  it("warns when the server address is missing", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        enabled: false,
        emailConfigured: true,
        appUrlConfigured: false,
      }),
    });

    await renderReset();

    await waitFor(() => expect(toggle()).toBeDisabled());
    expect(screen.getByText(/APP_URL/)).toBeInTheDocument();
  });

  it("assumes the address is set when the status cannot be read", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));

    await renderReset();

    expect(toggle()).not.toBeDisabled();
    expect(consoleError).toHaveBeenCalledWith(
      "Failed to check password reset status:",
      expect.any(Error),
    );
  });

  it("assumes the address is set when the status request fails", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });

    await renderReset();

    expect(toggle()).not.toBeDisabled();
  });

  it("saves the toggle", async () => {
    const { user, onFormDataChange } = await renderReset();

    await user.click(toggle());

    expect(onFormDataChange).toHaveBeenCalledWith({
      PASSWORD_RESET_ENABLED: true,
    });
  });

  it("explains what the toggle turns on", async () => {
    await renderReset();

    expect(
      screen.getByText(/Show a Forgot password link on the sign-in page/),
    ).toBeInTheDocument();
  });

  it("says nothing while the signed-in admin has an address of their own", async () => {
    await renderReset();

    expect(unmet()).toEqual([]);
  });

  it("blocks the toggle when the signed-in admin has no address", async () => {
    auth.user = { id: "a-1", username: "owner", email: "" };

    await renderReset();

    expect(toggle()).toBeDisabled();
    expect(unmet()).toEqual(["Add an email address to your admin account"]);
  });

  it("gathers every unmet requirement into one list", async () => {
    auth.user = { id: "a-1", username: "owner", email: "" };
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ appUrlConfigured: false }),
    });

    await renderReset({ settings: smtp({ SMTP_ENABLED: "false" }) });

    expect(screen.getAllByText(/need the following first/)).toHaveLength(1);
    expect(unmet()).toEqual([
      "Configure and enable a mail server under Email settings",
      "Set the APP_URL environment variable",
      "Add an email address to your admin account",
    ]);
  });

  it("drops a requirement from the list once it is met", async () => {
    auth.user = { id: "a-1", username: "owner", email: "" };
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ appUrlConfigured: false }),
    });

    await renderReset();

    expect(unmet()).toEqual([
      "Set the APP_URL environment variable",
      "Add an email address to your admin account",
    ]);
  });
});
