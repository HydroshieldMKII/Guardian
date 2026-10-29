import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdminTools } from "@/components/settings/AdminTools";

const resetStreamCounts = jest.fn<Promise<unknown>, unknown[]>();
const clearSessionHistory = jest.fn<Promise<unknown>, unknown[]>();
const deleteAllDevices = jest.fn<Promise<unknown>, unknown[]>();
const resetDatabase = jest.fn<Promise<unknown>, unknown[]>();
const exportDatabase = jest.fn<Promise<unknown>, unknown[]>();
const importDatabase = jest.fn<Promise<unknown>, unknown[]>();

jest.mock("@/lib/api", () => ({
  apiClient: {
    resetStreamCounts: (...a: unknown[]) => resetStreamCounts(...a),
    clearSessionHistory: (...a: unknown[]) => clearSessionHistory(...a),
    deleteAllDevices: (...a: unknown[]) => deleteAllDevices(...a),
    resetDatabase: (...a: unknown[]) => resetDatabase(...a),
    exportDatabase: (...a: unknown[]) => exportDatabase(...a),
    importDatabase: (...a: unknown[]) => importDatabase(...a),
  },
}));

const toast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

let versionInfo: Record<string, unknown> | null = null;
jest.mock("@/hooks/useVersionInfo", () => ({
  useVersionInfo: () => ({ versionInfo }),
}));

jest.mock("@/components/ui/confirmation-modal", () => ({
  ConfirmationModal: ({
    isOpen,
    title,
    onClose,
    onConfirm,
  }: {
    isOpen: boolean;
    title: string;
    onClose: () => void;
    onConfirm: () => void;
  }) =>
    isOpen ? (
      <div>
        <span>{`confirm:${title}`}</span>
        <button onClick={onConfirm}>{`yes ${title}`}</button>
        <button onClick={onClose}>{`no ${title}`}</button>
      </div>
    ) : null,
}));

jest.mock("@/components/ui/password-confirmation-modal", () => ({
  PasswordConfirmationModal: ({
    isOpen,
    title,
    isDangerous,
    onClose,
    onConfirm,
  }: {
    isOpen: boolean;
    title: string;
    isDangerous?: boolean;
    onClose: () => void;
    onConfirm: (password: string) => void;
  }) =>
    isOpen ? (
      <div>
        <span>{`password:${title}:${Boolean(isDangerous)}`}</span>
        <button onClick={() => onConfirm("hunter2")}>submit password</button>
        <button onClick={onClose}>dismiss password</button>
      </div>
    ) : null,
}));

const renderPanel = () => {
  const onSettingsRefresh = jest.fn();
  const view = render(<AdminTools onSettingsRefresh={onSettingsRefresh} />);
  return { ...view, onSettingsRefresh, user: userEvent.setup() };
};

const runGuarded = async (
  user: ReturnType<typeof userEvent.setup>,
  title: string,
) => {
  await user.click(screen.getByRole("button", { name: title }));
  await user.click(screen.getByRole("button", { name: `yes ${title}` }));
  await user.click(screen.getByRole("button", { name: "submit password" }));
};

let consoleError: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  localStorage.clear();
  versionInfo = { version: "2.0.0" };
  resetStreamCounts.mockResolvedValue(undefined);
  clearSessionHistory.mockResolvedValue(undefined);
  deleteAllDevices.mockResolvedValue(undefined);
  resetDatabase.mockResolvedValue(undefined);
  exportDatabase.mockResolvedValue({ settings: [] });
  importDatabase.mockResolvedValue(undefined);
  Object.defineProperty(window.URL, "createObjectURL", {
    configurable: true,
    value: jest.fn(() => "blob:mock"),
  });
  Object.defineProperty(window.URL, "revokeObjectURL", {
    configurable: true,
    value: jest.fn(),
  });
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("AdminTools post-reload notice", () => {
  it("announces a completed import once", () => {
    localStorage.setItem("guardianImportSuccess", "true");
    renderPanel();

    expect(toast).toHaveBeenCalledWith({
      title: "Settings imported",
      description: "Your imported settings are now in use.",
      variant: "success",
    });
    expect(localStorage.getItem("guardianImportSuccess")).toBeNull();
  });

  it("stays quiet otherwise", () => {
    renderPanel();
    expect(toast).not.toHaveBeenCalled();
  });
});

describe.each([
  ["Reset stream counts", () => resetStreamCounts, false],
  ["Clear session history", () => clearSessionHistory, true],
  ["Delete all devices", () => deleteAllDevices, true],
] as const)("AdminTools %s", (label, getMock, dangerous) => {
  it("asks for confirmation, then a password, then runs", async () => {
    const { user } = renderPanel();

    await user.click(screen.getByRole("button", { name: label }));
    expect(screen.getByText(`confirm:${label}`)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: `yes ${label}` }));
    expect(
      screen.getByText(`password:${label}:${dangerous}`),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "submit password" }));

    await waitFor(() => expect(getMock()).toHaveBeenCalledWith("hunter2"));
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: "success" }),
    );
  });

  it("reports a failure and keeps the password prompt open", async () => {
    getMock().mockRejectedValue(new Error("wrong password"));
    const { user } = renderPanel();

    await user.click(screen.getByRole("button", { name: label }));
    await user.click(screen.getByRole("button", { name: `yes ${label}` }));
    await user.click(screen.getByRole("button", { name: "submit password" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: "destructive",
          description: "wrong password",
        }),
      ),
    );
    expect(
      screen.getByText(`password:${label}:${dangerous}`),
    ).toBeInTheDocument();
  });

  it("falls back to a generic failure message", async () => {
    getMock().mockRejectedValue("boom");
    const { user } = renderPanel();

    await user.click(screen.getByRole("button", { name: label }));
    await user.click(screen.getByRole("button", { name: `yes ${label}` }));
    await user.click(screen.getByRole("button", { name: "submit password" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      ),
    );
  });

  it("can be abandoned at the confirmation", async () => {
    const { user } = renderPanel();

    await user.click(screen.getByRole("button", { name: label }));
    await user.click(screen.getByRole("button", { name: `no ${label}` }));

    expect(screen.queryByText(`confirm:${label}`)).toBeNull();
    expect(getMock()).not.toHaveBeenCalled();
  });

  it("can be abandoned at the password prompt", async () => {
    const { user } = renderPanel();

    await user.click(screen.getByRole("button", { name: label }));
    await user.click(screen.getByRole("button", { name: `yes ${label}` }));
    await user.click(screen.getByRole("button", { name: "dismiss password" }));

    expect(screen.queryByText(/^password:/)).toBeNull();
    expect(getMock()).not.toHaveBeenCalled();
  });
});

describe("AdminTools dangerous operations", () => {
  const operations = [
    {
      trigger: "Reset stream counts",
      confirm: "Reset stream counts",
      prompt: "Reset stream counts:false",
      endpoint: () => resetStreamCounts,
    },
    {
      trigger: "Clear session history",
      confirm: "Clear session history",
      prompt: "Clear session history:true",
      endpoint: () => clearSessionHistory,
    },
    {
      trigger: "Delete all devices",
      confirm: "Delete all devices",
      prompt: "Delete all devices:true",
      endpoint: () => deleteAllDevices,
    },
    {
      trigger: "Factory reset",
      confirm: "Factory reset",
      prompt: "Factory reset:true",
      endpoint: () => resetDatabase,
    },
  ];

  it.each(operations)(
    "asks $trigger for a password instead of taking the click event as one",
    async ({ trigger, confirm, prompt, endpoint }) => {
      const { user } = renderPanel();

      await user.click(screen.getByRole("button", { name: trigger }));
      await user.click(screen.getByRole("button", { name: `yes ${confirm}` }));

      expect(screen.getByText(`password:${prompt}`)).toBeInTheDocument();
      expect(endpoint()).not.toHaveBeenCalled();

      await user.click(screen.getByRole("button", { name: "submit password" }));
      await waitFor(() => expect(endpoint()).toHaveBeenCalledWith("hunter2"));
    },
  );

  it.each(operations)(
    "only ever sends $trigger a string password",
    async ({ trigger, confirm, endpoint }) => {
      const { user } = renderPanel();

      await user.click(screen.getByRole("button", { name: trigger }));
      await user.click(screen.getByRole("button", { name: `yes ${confirm}` }));
      await user.click(screen.getByRole("button", { name: "submit password" }));

      await waitFor(() => expect(endpoint()).toHaveBeenCalled());
      for (const call of endpoint().mock.calls) {
        expect(typeof call[0]).toBe("string");
      }
    },
  );
});

describe("AdminTools factory reset", () => {
  it("wipes, refreshes settings and reloads the page", async () => {
    jest.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onSettingsRefresh = jest.fn();
    render(<AdminTools onSettingsRefresh={onSettingsRefresh} />);

    await user.click(screen.getByRole("button", { name: "Factory reset" }));
    await user.click(screen.getByRole("button", { name: "yes Factory reset" }));
    expect(screen.getByText("password:Factory reset:true")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "submit password" }));
    await act(async () => {});

    expect(resetDatabase).toHaveBeenCalledWith("hunter2");
    expect(onSettingsRefresh).toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
  });

  it("reports a failure without reloading", async () => {
    resetDatabase.mockRejectedValue(new Error("denied"));
    const { user } = renderPanel();

    await runGuarded(user, "Factory reset");

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "denied" }),
      ),
    );
  });

  it("works without a refresh callback", async () => {
    const user = userEvent.setup();
    render(<AdminTools />);

    await runGuarded(user, "Factory reset");

    await waitFor(() => expect(resetDatabase).toHaveBeenCalled());
  });
});

describe("AdminTools export", () => {
  it("downloads the database", async () => {
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});
    const { user } = renderPanel();

    await user.click(screen.getByRole("button", { name: /Export/ }));

    await waitFor(() => expect(exportDatabase).toHaveBeenCalled());
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });

  it("reports a failure", async () => {
    exportDatabase.mockRejectedValue(new Error("disk full"));
    const { user } = renderPanel();

    await user.click(screen.getByRole("button", { name: /Export/ }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "destructive" }),
      ),
    );
  });
});

describe("AdminTools import", () => {
  const selectFile = async (body: string) => {
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = new File([body], "backup.json", {
      type: "application/json",
    });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    await act(async () => {
      await Promise.resolve();
    });
  };

  it("ignores an empty selection", async () => {
    renderPanel();
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, { target: { files: [] } });
    });

    expect(importDatabase).not.toHaveBeenCalled();
  });

  it("imports a matching-version file", async () => {
    const { onSettingsRefresh } = renderPanel();

    await selectFile(JSON.stringify({ version: "2.0.0" }));

    await waitFor(() => expect(importDatabase).toHaveBeenCalled());
    expect(onSettingsRefresh).toHaveBeenCalled();
  });

  it("imports when no version is recorded", async () => {
    renderPanel();

    await selectFile(JSON.stringify({ settings: [] }));

    await waitFor(() => expect(importDatabase).toHaveBeenCalled());
  });

  it("imports when the app version is unknown", async () => {
    versionInfo = null;
    renderPanel();

    await selectFile(JSON.stringify({ version: "1.0.0" }));

    await waitFor(() => expect(importDatabase).toHaveBeenCalled());
  });

  it("rejects a corrupted file", async () => {
    renderPanel();

    await selectFile("not json");

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Invalid file" }),
      ),
    );
    expect(importDatabase).not.toHaveBeenCalled();
  });

  it("reports a server failure", async () => {
    importDatabase.mockRejectedValue(new Error("schema mismatch"));
    renderPanel();

    await selectFile(JSON.stringify({ version: "2.0.0" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "schema mismatch" }),
      ),
    );
    expect(consoleError).toHaveBeenCalledWith(
      "Import error:",
      expect.any(Error),
    );
  });

  it("falls back for a non-Error rejection", async () => {
    importDatabase.mockRejectedValue("boom");
    renderPanel();

    await selectFile(JSON.stringify({ version: "2.0.0" }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Failed to import settings" }),
      ),
    );
  });

  it("flags a post-reload notice and reloads on success", async () => {
    jest.useFakeTimers();
    render(<AdminTools onSettingsRefresh={jest.fn()} />);
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;

    await act(async () => {
      fireEvent.change(input, {
        target: {
          files: [
            new File([JSON.stringify({ version: "2.0.0" })], "b.json", {
              type: "application/json",
            }),
          ],
        },
      });
    });
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await Promise.resolve();
      });
    }

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });

    expect(localStorage.getItem("guardianImportSuccess")).toBe("true");
  });

  describe("on a version mismatch", () => {
    it("warns before importing", async () => {
      renderPanel();

      await selectFile(JSON.stringify({ version: "1.3.5" }));

      expect(
        screen.getByText("confirm:Exported by a different version"),
      ).toBeInTheDocument();
      expect(importDatabase).not.toHaveBeenCalled();
    });

    it("imports anyway when confirmed", async () => {
      const { user } = renderPanel();
      await selectFile(JSON.stringify({ version: "1.3.5" }));

      await user.click(
        screen.getByRole("button", {
          name: "yes Exported by a different version",
        }),
      );

      await waitFor(() => expect(importDatabase).toHaveBeenCalled());
    });

    it("abandons the import when cancelled", async () => {
      const { user } = renderPanel();
      await selectFile(JSON.stringify({ version: "1.3.5" }));

      await user.click(
        screen.getByRole("button", {
          name: "no Exported by a different version",
        }),
      );

      expect(screen.queryByText(/^confirm:Version/)).toBeNull();
      expect(importDatabase).not.toHaveBeenCalled();
    });
  });
});
