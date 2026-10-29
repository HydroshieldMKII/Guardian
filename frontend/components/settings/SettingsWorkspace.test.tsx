import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SettingsWorkspace } from "@/components/settings/SettingsWorkspace";
import type { SettingsFormData } from "@/components/settings/settings-utils";
import { appSetting } from "@/test-utils/dashboard";

const push = jest.fn();
jest.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const updateConfig = jest.fn<Promise<void>, [unknown]>();
jest.mock("@/lib/api", () => ({
  apiClient: { updateConfig: (changes: unknown) => updateConfig(changes) },
}));

const toast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

let versionInfo: { version: string } | null = null;
jest.mock("@/hooks/useVersionInfo", () => ({
  useVersionInfo: () => ({ versionInfo }),
}));

const setHasUnsavedChanges = jest.fn<void, [boolean]>();
jest.mock("@/contexts/unsaved-changes-context", () => ({
  useUnsavedChanges: () => ({
    setHasUnsavedChanges,
    setOnSaveAndLeave: jest.fn(),
    setOnDiscardChanges: jest.fn(),
  }),
}));

interface FormProps {
  formData: SettingsFormData;
  onFormDataChange: (updates: Partial<SettingsFormData>) => void;
  hasUnsavedChanges?: boolean;
  sectionId?: string;
}

function FormStub({
  name,
  formData,
  onFormDataChange,
  hasUnsavedChanges,
  sectionId,
}: FormProps & { name: string }) {
  return (
    <div data-testid={name}>
      {[name, sectionId, hasUnsavedChanges && "dirty"]
        .filter(Boolean)
        .join(":")}
      <input
        aria-label={`${name} server`}
        value={String(formData.PLEX_SERVER_IP ?? "")}
        onChange={(event) =>
          onFormDataChange({ PLEX_SERVER_IP: event.target.value })
        }
      />
    </div>
  );
}

jest.mock("@/components/settings/PlexSettings", () => ({
  PlexSettings: (props: FormProps) => <FormStub name="plex" {...props} />,
}));
jest.mock("@/components/settings/SMTPSettings", () => ({
  SMTPSettings: (props: FormProps) => <FormStub name="smtp" {...props} />,
}));
jest.mock("@/components/settings/AppriseSettings", () => ({
  AppriseSettings: (props: FormProps) => <FormStub name="apprise" {...props} />,
}));
jest.mock("@/components/settings/GeneralSettings", () => ({
  GeneralSettings: (props: FormProps) => <FormStub name="general" {...props} />,
}));
jest.mock("@/components/settings/SystemInfo", () => ({
  SystemInfo: (props: FormProps) => <FormStub name="system" {...props} />,
}));
jest.mock("@/components/settings/AppearanceSettings", () => ({
  AppearanceSettings: () => <div>appearance</div>,
}));
jest.mock("@/components/settings/AdminTools", () => ({
  AdminTools: ({ onSettingsRefresh }: { onSettingsRefresh: () => void }) => (
    <button onClick={onSettingsRefresh}>refresh settings</button>
  ),
}));

const SETTINGS = [appSetting("PLEX_SERVER_IP", "10.0.0.2")];
const updateSettings = jest.fn();
const onSettingsRefresh = jest.fn();

const renderWorkspace = () => {
  const ui = userEvent.setup();
  render(
    <SettingsWorkspace
      settings={SETTINGS}
      updateSettings={updateSettings}
      onSettingsRefresh={onSettingsRefresh}
    />,
  );
  return ui;
};

const edit = async (ui: ReturnType<typeof userEvent.setup>) => {
  const input = screen.getByLabelText("plex server");
  await ui.clear(input);
  await ui.type(input, "10.0.0.3");
};

const openTab = (ui: ReturnType<typeof userEvent.setup>, name: string) =>
  ui.click(screen.getByRole("tab", { name }));

beforeEach(() => {
  jest.clearAllMocks();
  versionInfo = null;
  updateConfig.mockResolvedValue(undefined);
  window.history.replaceState(null, "", " ");
});

describe("tabs", () => {
  it("opens on the Plex tab with its description", () => {
    renderWorkspace();

    expect(screen.getByTestId("plex")).toHaveTextContent("plex");
    expect(
      screen.getByText("How to reach your Plex Media Server"),
    ).toBeInTheDocument();
  });

  it.each([
    ["Guardian", ["general:guardian"]],
    ["Customization", ["appearance", "general:customization"]],
    ["Email", ["smtp"]],
    ["Notifications", ["general:notifications", "apprise"]],
    ["System", ["system"]],
  ])("shows the %s tab", async (tab, contents) => {
    const ui = renderWorkspace();

    await openTab(ui, tab);

    const panel = screen.getByRole("tabpanel");
    contents.forEach((text) =>
      expect(within(panel).getByText(text)).toBeInTheDocument(),
    );
  });

  it("lets maintenance refresh the settings", async () => {
    const ui = renderWorkspace();

    await openTab(ui, "Maintenance");
    await ui.click(screen.getByRole("button", { name: "refresh settings" }));

    expect(onSettingsRefresh).toHaveBeenCalled();
  });

  it("jumps to the System tab from the version pill", async () => {
    versionInfo = { version: "2.2.0" };
    const ui = renderWorkspace();

    await ui.click(screen.getByTitle("View system information"));

    expect(screen.getByText("v2.2.0")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "System" })).toHaveAttribute(
      "data-state",
      "active",
    );
  });

  it("hides the version pill until the version is known", () => {
    renderWorkspace();

    expect(screen.queryByTitle("View system information")).toBeNull();
  });
});

describe("unsaved changes", () => {
  it("shows the save bar after an edit and shares the state", async () => {
    const ui = renderWorkspace();

    await edit(ui);

    expect(screen.getByText("You have unsaved changes")).toBeInTheDocument();
    expect(screen.getByTestId("plex")).toHaveTextContent("plex:dirty");
    expect(setHasUnsavedChanges).toHaveBeenLastCalledWith(true);
  });

  it("drops the edits on cancel", async () => {
    const ui = renderWorkspace();
    await edit(ui);

    await ui.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByLabelText("plex server")).toHaveValue("10.0.0.2");
    expect(screen.queryByText("You have unsaved changes")).toBeNull();
  });

  it("saves the edits from the bar", async () => {
    const ui = renderWorkspace();
    await edit(ui);

    await ui.click(screen.getByRole("button", { name: "Save now" }));

    expect(updateConfig).toHaveBeenCalledWith([
      { key: "PLEX_SERVER_IP", value: "10.0.0.3", type: "string" },
    ]);
    await waitFor(() =>
      expect(screen.queryByText("You have unsaved changes")).toBeNull(),
    );
  });
});

describe("leaving", () => {
  it("goes straight back when nothing changed", async () => {
    const ui = renderWorkspace();

    await ui.click(screen.getByRole("button", { name: "Back to Dashboard" }));

    expect(push).toHaveBeenCalledWith("/");
  });

  it("asks first when there are edits, and stays if told to", async () => {
    const ui = renderWorkspace();
    await edit(ui);

    await ui.click(screen.getByRole("button", { name: "Back to Dashboard" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Unsaved changes");

    await ui.click(screen.getByRole("button", { name: "Stay on page" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(push).not.toHaveBeenCalled();
  });

  it("stays when the dialog is dismissed", async () => {
    const ui = renderWorkspace();
    await edit(ui);
    await ui.click(screen.getByRole("button", { name: "Back to Dashboard" }));

    await ui.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(push).not.toHaveBeenCalled();
  });

  it("leaves without saving on discard", async () => {
    const ui = renderWorkspace();
    await edit(ui);
    await ui.click(screen.getByRole("button", { name: "Back to Dashboard" }));

    await ui.click(screen.getByRole("button", { name: "Discard changes" }));

    expect(updateConfig).not.toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith("/");
  });

  it("saves and then leaves", async () => {
    const ui = renderWorkspace();
    await edit(ui);
    await ui.click(screen.getByRole("button", { name: "Back to Dashboard" }));

    await ui.click(screen.getByRole("button", { name: "Save & Leave" }));

    expect(updateConfig).toHaveBeenCalled();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });

  it("stays on the page when saving before leaving fails", async () => {
    updateConfig.mockRejectedValue(new Error("down"));
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const ui = renderWorkspace();
    await edit(ui);
    await ui.click(screen.getByRole("button", { name: "Back to Dashboard" }));

    await ui.click(screen.getByRole("button", { name: "Save & Leave" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Error", description: "down" }),
      ),
    );
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("plex server")).toHaveValue("10.0.0.3");
    consoleError.mockRestore();
  });
});
