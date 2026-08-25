import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatabaseManagement } from "@/components/settings/DatabaseManagement";

const exportDatabase = jest.fn();
const importDatabase = jest.fn();
jest.mock("@/lib/api", () => ({
  apiClient: {
    exportDatabase: (...a: unknown[]) => exportDatabase(...a),
    importDatabase: (...a: unknown[]) => importDatabase(...a),
  },
}));

const toast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

let versionInfo: Record<string, unknown> | null = null;
jest.mock("@/contexts/version-context", () => ({
  useVersion: () => ({ versionInfo }),
}));

jest.mock("@/components/ui/confirmation-modal", () => ({
  ConfirmationModal: ({
    isOpen,
    description,
    onClose,
    onConfirm,
  }: {
    isOpen: boolean;
    description: string;
    onClose: () => void;
    onConfirm: () => void;
  }) =>
    isOpen ? (
      <div>
        <span>{description}</span>
        <button onClick={onConfirm}>confirm import</button>
        <button onClick={onClose}>cancel import</button>
      </div>
    ) : null,
}));

const jsonFile = (body: string, name = "backup.json") =>
  new File([body], name, { type: "application/json" });

const selectFile = async (file: File) => {
  const input = document.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });
  await act(async () => {
    await Promise.resolve();
  });
};

const renderPanel = () => {
  const onSettingsRefresh = jest.fn();
  const view = render(
    <DatabaseManagement onSettingsRefresh={onSettingsRefresh} />,
  );
  return { ...view, onSettingsRefresh, user: userEvent.setup() };
};

let consoleError: jest.SpyInstance;
let createObjectURL: jest.Mock;
let revokeObjectURL: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  versionInfo = {
    version: "2.0.0",
    databaseVersion: "2.0.0",
    codeVersion: "2.0.0",
  };
  exportDatabase.mockResolvedValue({ settings: [] });
  importDatabase.mockResolvedValue({ imported: 5, skipped: 1 });
  createObjectURL = jest.fn(() => "blob:mock");
  revokeObjectURL = jest.fn();
  Object.defineProperty(window.URL, "createObjectURL", {
    configurable: true,
    value: createObjectURL,
  });
  Object.defineProperty(window.URL, "revokeObjectURL", {
    configurable: true,
    value: revokeObjectURL,
  });
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("DatabaseManagement export", () => {
  it("downloads a dated JSON file", async () => {
    const { user } = renderPanel();
    const click = jest
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    await user.click(screen.getByRole("button", { name: /Export/ }));

    await waitFor(() => expect(exportDatabase).toHaveBeenCalled());
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
    expect(click).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Export successful" }),
    );
    click.mockRestore();
  });

  it("reports a failure", async () => {
    exportDatabase.mockRejectedValue(new Error("disk full"));
    const { user } = renderPanel();

    await user.click(screen.getByRole("button", { name: /Export/ }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Export failed" }),
      ),
    );
    expect(consoleError).toHaveBeenCalledWith(
      "Export error:",
      expect.any(Error),
    );
  });
});

describe("DatabaseManagement import", () => {
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

  it("imports a matching-version file straight away", async () => {
    const { onSettingsRefresh } = renderPanel();

    await selectFile(jsonFile(JSON.stringify({ version: "2.0.0" })));

    await waitFor(() => expect(importDatabase).toHaveBeenCalled());
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Import successful",
        description: "Imported 5 items, skipped 1 items",
      }),
    );
    expect(onSettingsRefresh).toHaveBeenCalled();
  });

  it("imports a file with no version recorded", async () => {
    renderPanel();

    await selectFile(jsonFile(JSON.stringify({ settings: [] })));

    await waitFor(() => expect(importDatabase).toHaveBeenCalled());
  });

  it("imports when the app version is unknown", async () => {
    versionInfo = null;
    renderPanel();

    await selectFile(jsonFile(JSON.stringify({ version: "1.0.0" })));

    await waitFor(() => expect(importDatabase).toHaveBeenCalled());
  });

  it("unwraps a nested import result", async () => {
    importDatabase.mockResolvedValue({ imported: { imported: 2, skipped: 3 } });
    renderPanel();

    await selectFile(jsonFile(JSON.stringify({ version: "2.0.0" })));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Imported 2 items, skipped 3 items",
        }),
      ),
    );
  });

  it("says unknown when the counts are missing", async () => {
    importDatabase.mockResolvedValue({});
    renderPanel();

    await selectFile(jsonFile(JSON.stringify({ version: "2.0.0" })));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Imported unknown items, skipped unknown items",
        }),
      ),
    );
  });

  it("rejects a corrupted file", async () => {
    renderPanel();

    await selectFile(jsonFile("not json at all"));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Import failed",
          description: "Invalid file format or corrupted data",
        }),
      ),
    );
    expect(importDatabase).not.toHaveBeenCalled();
  });

  it("reports a server failure", async () => {
    importDatabase.mockRejectedValue(new Error("schema mismatch"));
    renderPanel();

    await selectFile(jsonFile(JSON.stringify({ version: "2.0.0" })));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "schema mismatch" }),
      ),
    );
  });

  it("falls back for a non-Error rejection", async () => {
    importDatabase.mockRejectedValue("boom");
    renderPanel();

    await selectFile(jsonFile(JSON.stringify({ version: "2.0.0" })));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ description: "Failed to import database" }),
      ),
    );
  });

  describe("on a version mismatch", () => {
    const mismatched = () =>
      selectFile(jsonFile(JSON.stringify({ version: "1.3.5" })));

    it("warns before importing", async () => {
      renderPanel();

      await mismatched();

      expect(
        screen.getByText(
          /created with version 1\.3\.5.*running version 2\.0\.0/,
        ),
      ).toBeInTheDocument();
      expect(importDatabase).not.toHaveBeenCalled();
    });

    it("imports anyway when confirmed", async () => {
      const { user } = renderPanel();
      await mismatched();

      await user.click(screen.getByRole("button", { name: "confirm import" }));

      await waitFor(() => expect(importDatabase).toHaveBeenCalled());
    });

    it("abandons the import when cancelled", async () => {
      const { user } = renderPanel();
      await mismatched();

      await user.click(screen.getByRole("button", { name: "cancel import" }));

      expect(screen.queryByText(/created with version/)).toBeNull();
      expect(importDatabase).not.toHaveBeenCalled();
    });

    it("reports a corrupted file discovered on confirmation", async () => {
      renderPanel();
      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = jsonFile(JSON.stringify({ version: "1.3.5" }));

      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });
      await act(async () => {
        await Promise.resolve();
      });

      const originalText = File.prototype.text;
      jest
        .spyOn(FileReader.prototype, "readAsText")
        .mockImplementation(function (this: FileReader) {
          Object.defineProperty(this, "result", { value: "broken" });
          this.onload?.({
            target: this,
          } as unknown as ProgressEvent<FileReader>);
        });

      fireEvent.click(screen.getByRole("button", { name: "confirm import" }));

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            description: "Invalid file format or corrupted data",
          }),
        ),
      );
      File.prototype.text = originalText;
    });
  });
});

describe("DatabaseManagement versions", () => {
  it("shows both recorded versions", () => {
    renderPanel();
    expect(screen.getByText("Database Version:")).toBeInTheDocument();
    expect(screen.getByText("Code Version:")).toBeInTheDocument();
  });
});
