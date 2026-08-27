import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EditProfileModal } from "@/components/edit-profile-modal";

const updateProfile = jest.fn();
const updatePassword = jest.fn();
const linkPlexAccount = jest.fn();
const unlinkPlexAccount = jest.fn();
let user: Record<string, unknown> | null = null;

jest.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({
    user,
    updateProfile,
    updatePassword,
    linkPlexAccount,
    unlinkPlexAccount,
  }),
  isAdminUser: (candidate: Record<string, unknown> | null) =>
    Boolean(candidate && "username" in candidate),
}));

const toast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast }) }));

const admin = {
  username: "testuser",
  email: "test@example.com",
  avatarUrl: "",
};

const fetchMock = jest.fn();
let consoleError: jest.SpyInstance;

const renderModal = async (open = true) => {
  const onOpenChange = jest.fn();
  const view = render(
    <EditProfileModal open={open} onOpenChange={onOpenChange} />,
  );
  if (open) await screen.findByText("Edit Profile");
  return { ...view, onOpenChange, ui: userEvent.setup() };
};

const openTab = async (ui: ReturnType<typeof userEvent.setup>, name: string) =>
  ui.click(screen.getByRole("tab", { name }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  user = { ...admin };
  updateProfile.mockResolvedValue(undefined);
  updatePassword.mockResolvedValue(undefined);
  linkPlexAccount.mockResolvedValue(undefined);
  unlinkPlexAccount.mockResolvedValue(undefined);
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  consoleError.mockRestore();
  jest.restoreAllMocks();
});

describe("EditProfileModal", () => {
  it("stays closed", async () => {
    await renderModal(false);
    expect(screen.queryByText("Edit Profile")).toBeNull();
  });

  it("seeds the profile form from the signed-in admin", async () => {
    await renderModal();

    expect(screen.getByLabelText("Username")).toHaveValue("testuser");
    expect(screen.getByLabelText(/Email/)).toHaveValue("test@example.com");
  });

  it("marks the email optional with a badge on the label row", async () => {
    await renderModal();

    const badge = screen
      .getByText("Optional")
      .closest("span.rounded-full") as HTMLElement;
    const label = screen.getByText("Email");

    expect(badge).not.toBeNull();
    expect(label.parentElement?.parentElement).toContainElement(badge);
  });

  it("copes with an admin who has no email or avatar recorded", async () => {
    user = { username: "testuser", email: undefined, avatarUrl: undefined };
    await renderModal();

    expect(screen.getByLabelText(/Email/)).toHaveValue("");
    expect(screen.queryByRole("button", { name: /Delete/ })).toBeNull();
  });

  it("renders nothing for the avatar without a user", async () => {
    user = null;
    await renderModal();

    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("shows the admin's initials", async () => {
    user = { ...admin, username: "Test User" };
    await renderModal();
    expect(screen.getByText("TU")).toBeInTheDocument();
  });

  it("falls back to a question mark for a non-admin", async () => {
    user = { plexUsername: "someone" };
    await renderModal();
    expect(screen.getByText("?")).toBeInTheDocument();
  });

  it("cancels without saving", async () => {
    const { ui, onOpenChange } = await renderModal();

    await ui.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(updateProfile).not.toHaveBeenCalled();
  });

  describe("saving the profile", () => {
    it("sends only what changed", async () => {
      const { ui, onOpenChange } = await renderModal();

      await ui.clear(screen.getByLabelText("Username"));
      await ui.type(screen.getByLabelText("Username"), "renamed");
      await ui.click(screen.getByRole("button", { name: /Save Changes/ }));

      await waitFor(() =>
        expect(updateProfile).toHaveBeenCalledWith({ username: "renamed" }),
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });

    it("rejects a malformed email", async () => {
      const { ui } = await renderModal();

      await ui.clear(screen.getByLabelText(/Email/));
      await ui.type(screen.getByLabelText(/Email/), "someone@localhost");
      await ui.click(screen.getByRole("button", { name: /Save Changes/ }));

      expect(
        await screen.findByText("Please enter a valid email address"),
      ).toBeInTheDocument();
      expect(updateProfile).not.toHaveBeenCalled();
    });

    it("accepts an empty email as removal", async () => {
      const { ui } = await renderModal();

      await ui.clear(screen.getByLabelText(/Email/));
      await ui.click(screen.getByRole("button", { name: /Save Changes/ }));

      await waitFor(() =>
        expect(updateProfile).toHaveBeenCalledWith({ email: "" }),
      );
    });

    it("reports a save failure and stays open", async () => {
      updateProfile.mockRejectedValue(new Error("server said no"));
      const { ui, onOpenChange } = await renderModal();

      await ui.clear(screen.getByLabelText("Username"));
      await ui.type(screen.getByLabelText("Username"), "renamed");
      await ui.click(screen.getByRole("button", { name: /Save Changes/ }));

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: "destructive",
            description: "server said no",
          }),
        ),
      );
      expect(onOpenChange).not.toHaveBeenCalledWith(false);
    });

    it("falls back to a generic failure message", async () => {
      updateProfile.mockRejectedValue("boom");
      const { ui } = await renderModal();

      await ui.type(screen.getByLabelText("Username"), "x");
      await ui.click(screen.getByRole("button", { name: /Save Changes/ }));

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            description: "Failed to update profile",
          }),
        ),
      );
    });

    it("cannot be saved when nothing has changed", async () => {
      await renderModal();
      expect(
        screen.getByRole("button", { name: /Save Changes/ }),
      ).toBeDisabled();
    });
  });

  describe("the avatar", () => {
    const selectFile = async (file: File) => {
      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } });
      });
    };

    it("opens the picker", async () => {
      const { ui } = await renderModal();
      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const click = jest.spyOn(input, "click").mockImplementation(() => {});

      await ui.click(screen.getByRole("button", { name: /Upload Avatar/ }));

      expect(click).toHaveBeenCalled();
      click.mockRestore();
    });

    it("ignores an empty selection", async () => {
      await renderModal();
      const input = document.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;

      await act(async () => {
        fireEvent.change(input, { target: { files: [] } });
      });

      expect(toast).not.toHaveBeenCalled();
    });

    it("rejects a non-image", async () => {
      await renderModal();

      await selectFile(new File(["x"], "notes.txt", { type: "text/plain" }));

      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Invalid file" }),
      );
    });

    it("rejects an oversized image", async () => {
      await renderModal();
      const big = new File(["x"], "big.png", { type: "image/png" });
      Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });

      await selectFile(big);

      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: "File too large" }),
      );
    });

    it("accepts an image and previews it", async () => {
      await renderModal();

      await selectFile(new File(["x"], "face.png", { type: "image/png" }));

      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /Delete/ }),
        ).toBeInTheDocument(),
      );
    });

    it("removes an existing avatar", async () => {
      user = { ...admin, avatarUrl: "data:image/png;base64,abc" };
      const { ui } = await renderModal();

      await ui.click(screen.getByRole("button", { name: /Delete/ }));

      expect(screen.queryByRole("button", { name: /Delete/ })).toBeNull();
    });
  });

  describe("changing the password", () => {
    const fill = async (
      ui: ReturnType<typeof userEvent.setup>,
      current: string,
      next: string,
      confirm: string,
    ) => {
      if (current)
        await ui.type(screen.getByLabelText("Current Password"), current);
      if (next) await ui.type(screen.getByLabelText("New Password"), next);
      if (confirm)
        await ui.type(screen.getByLabelText("Confirm Password"), confirm);
      await ui.click(screen.getByRole("button", { name: /Update Password/ }));
    };

    it("requires the current password", async () => {
      const { ui } = await renderModal();
      await openTab(ui, "Password");

      await fill(ui, "", "Str0ng!Passw0rd", "Str0ng!Passw0rd");

      expect(
        await screen.findByText("Please enter your current password"),
      ).toBeInTheDocument();
      expect(updatePassword).not.toHaveBeenCalled();
    });

    it("requires a new password", async () => {
      const { ui } = await renderModal();
      await openTab(ui, "Password");

      await fill(ui, "old-secret", "", "");

      expect(
        await screen.findByText("Please enter a new password"),
      ).toBeInTheDocument();
    });

    it("rejects a weak new password", async () => {
      const { ui } = await renderModal();
      await openTab(ui, "Password");

      await fill(ui, "old-secret", "weak", "weak");

      expect(
        await screen.findByText(/Password must contain uppercase/),
      ).toBeInTheDocument();
    });

    it("rejects a mismatched confirmation", async () => {
      const { ui } = await renderModal();
      await openTab(ui, "Password");

      await fill(ui, "old-secret", "Str0ng!Passw0rd", "Different!Passw0rd");

      expect(
        await screen.findByText("New passwords do not match"),
      ).toBeInTheDocument();
    });

    it("updates and closes", async () => {
      const { ui, onOpenChange } = await renderModal();
      await openTab(ui, "Password");

      await fill(ui, "old-secret", "Str0ng!Passw0rd", "Str0ng!Passw0rd");

      await waitFor(() =>
        expect(updatePassword).toHaveBeenCalledWith({
          currentPassword: "old-secret",
          newPassword: "Str0ng!Passw0rd",
          confirmPassword: "Str0ng!Passw0rd",
          clearSessions: true,
        }),
      );
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("can keep other sessions signed in", async () => {
      const { ui } = await renderModal();
      await openTab(ui, "Password");

      await ui.click(screen.getByRole("checkbox"));
      await fill(ui, "old-secret", "Str0ng!Passw0rd", "Str0ng!Passw0rd");

      await waitFor(() =>
        expect(updatePassword).toHaveBeenCalledWith(
          expect.objectContaining({ clearSessions: false }),
        ),
      );
    });

    it("reports a failure", async () => {
      updatePassword.mockRejectedValue(new Error("wrong password"));
      const { ui } = await renderModal();
      await openTab(ui, "Password");

      await fill(ui, "old-secret", "Str0ng!Passw0rd", "Str0ng!Passw0rd");

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({ description: "wrong password" }),
        ),
      );
    });

    it("falls back to a generic failure message", async () => {
      updatePassword.mockRejectedValue("boom");
      const { ui } = await renderModal();
      await openTab(ui, "Password");

      await fill(ui, "old-secret", "Str0ng!Passw0rd", "Str0ng!Passw0rd");

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            description: "Failed to update password",
          }),
        ),
      );
    });
  });

  describe("the Plex tab", () => {
    it("fetches fresh account data when it opens", async () => {
      await renderModal();
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith("/api/pg/auth/me", {
          credentials: "include",
        }),
      );
    });

    it("survives a failed lookup", async () => {
      fetchMock.mockResolvedValue({ ok: false });
      const { ui } = await renderModal();
      await openTab(ui, "Plex");

      expect(
        screen.getByRole("button", { name: /Link Plex Account/ }),
      ).toBeInTheDocument();
    });

    it("survives a rejected lookup", async () => {
      fetchMock.mockRejectedValue(new Error("offline"));
      const { ui } = await renderModal();
      await openTab(ui, "Plex");

      expect(
        screen.getByRole("button", { name: /Link Plex Account/ }),
      ).toBeInTheDocument();
    });

    it("falls back when the linked Plex account has no username", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ plexUserId: "p-1" }),
      });
      const { ui } = await renderModal();
      await openTab(ui, "Plex");

      expect((await screen.findAllByText("Plex User")).length).toBeGreaterThan(
        0,
      );
    });

    it("shows a linked account and unlinks it", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          plexUserId: "p-1",
          plexUsername: "plexperson",
          plexThumb: "/t.png",
        }),
      });
      const { ui } = await renderModal();
      await openTab(ui, "Plex");

      expect(await screen.findByText("plexperson")).toBeInTheDocument();

      await ui.click(
        screen.getByRole("button", { name: /Unlink Plex Account/ }),
      );

      await waitFor(() => expect(unlinkPlexAccount).toHaveBeenCalled());
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
    });

    it("reports an unlink failure", async () => {
      unlinkPlexAccount.mockRejectedValue(new Error("nope"));
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ plexUserId: "p-1", plexUsername: "plexperson" }),
      });
      const { ui } = await renderModal();
      await openTab(ui, "Plex");

      await ui.click(
        await screen.findByRole("button", { name: /Unlink Plex Account/ }),
      );

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({ title: "Unlink Failed" }),
        ),
      );
    });

    it("opens a Plex popup when linking", async () => {
      const popup = { closed: false, close: jest.fn() };
      const open = jest
        .spyOn(window, "open")
        .mockReturnValue(popup as unknown as Window);
      fetchMock.mockImplementation((url: string) =>
        url === "/api/pg/auth/plex/pin"
          ? Promise.resolve({
              ok: true,
              json: async () => ({
                clientId: "c-1",
                code: "ABCD",
                expiresAt: new Date(Date.now() + 600000).toISOString(),
              }),
            })
          : Promise.resolve({ ok: true, json: async () => ({}) }),
      );
      const { ui } = await renderModal();
      await openTab(ui, "Plex");

      await ui.click(screen.getByRole("button", { name: /Link Plex Account/ }));

      await waitFor(() => expect(open).toHaveBeenCalled());
      expect(open.mock.calls[0][0]).toContain("clientID=c-1");
      open.mockRestore();
    });

    it("reports a failure creating the PIN", async () => {
      fetchMock.mockImplementation((url: string) =>
        url === "/api/pg/auth/plex/pin"
          ? Promise.resolve({ ok: false })
          : Promise.resolve({ ok: true, json: async () => ({}) }),
      );
      const { ui } = await renderModal();
      await openTab(ui, "Plex");

      await ui.click(screen.getByRole("button", { name: /Link Plex Account/ }));

      await waitFor(() =>
        expect(toast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Plex Link Failed",
            description:
              "Guardian could not reach Plex. Try again in a moment.",
          }),
        ),
      );
    });

    it("survives a blocked popup", async () => {
      jest.spyOn(window, "open").mockReturnValue(null);
      fetchMock.mockImplementation((url: string) =>
        url === "/api/pg/auth/plex/pin"
          ? Promise.resolve({
              ok: true,
              json: async () => ({
                clientId: "c-1",
                code: "ABCD",
                expiresAt: new Date(Date.now() + 600000).toISOString(),
              }),
            })
          : Promise.resolve({ ok: true, json: async () => ({}) }),
      );
      const { ui } = await renderModal();
      await openTab(ui, "Plex");

      await ui.click(screen.getByRole("button", { name: /Link Plex Account/ }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    });
  });
});

describe("EditProfileModal Plex PIN polling", () => {
  let popup: { closed: boolean; close: jest.Mock };

  const wirePinFetch = (statusResponse: unknown) => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/pg/auth/plex/pin") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            clientId: "c-1",
            code: "ABCD",
            expiresAt: new Date(Date.now() + 600000).toISOString(),
          }),
        });
      }
      if (url.startsWith("/api/pg/auth/plex/pin/")) {
        return statusResponse instanceof Error
          ? Promise.reject(statusResponse)
          : Promise.resolve(statusResponse);
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
  };

  const startLinking = async () => {
    jest.useFakeTimers();
    render(<EditProfileModal open onOpenChange={jest.fn()} />);
    await flush();

    const tab = screen.getByRole("tab", { name: "Plex" });
    fireEvent.mouseDown(tab);
    fireEvent.click(tab);
    await flush();

    fireEvent.click(screen.getByRole("button", { name: /Link Plex Account/ }));
    await flush();
    expect(window.open).toHaveBeenCalled();
  };

  const flush = async () => {
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await Promise.resolve();
      });
    }
  };

  const tick = async (ms: number) => {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
    await flush();
  };

  beforeEach(() => {
    popup = { closed: false, close: jest.fn() };
    jest.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("links the account once Plex hands back a token", async () => {
    wirePinFetch({ ok: true, json: async () => ({ authToken: "tok" }) });
    await startLinking();

    await tick(2000);

    expect(linkPlexAccount).toHaveBeenCalledWith("tok");
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "You can now sign in to Guardian with Plex",
      }),
    );
    expect(popup.close).toHaveBeenCalled();
  });

  it("keeps waiting while Plex has no token yet", async () => {
    wirePinFetch({ ok: true, json: async () => ({}) });
    await startLinking();

    await tick(2000);

    expect(linkPlexAccount).not.toHaveBeenCalled();
  });

  it("keeps waiting when the PIN lookup is rejected", async () => {
    wirePinFetch({ ok: false });
    await startLinking();

    await tick(2000);

    expect(linkPlexAccount).not.toHaveBeenCalled();
  });

  it("logs a PIN lookup that throws", async () => {
    wirePinFetch(new Error("offline"));
    await startLinking();

    await tick(2000);

    expect(consoleError).toHaveBeenCalledWith(
      "Failed to check Plex PIN:",
      expect.any(Error),
    );
  });

  it("reports a link that the server refuses", async () => {
    linkPlexAccount.mockRejectedValue(new Error("already linked"));
    wirePinFetch({ ok: true, json: async () => ({ authToken: "tok" }) });
    await startLinking();

    await tick(2000);

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Plex Link Failed",
        description: "already linked",
      }),
    );
  });

  it("falls back to a generic message when the link failure carries none", async () => {
    linkPlexAccount.mockRejectedValue("nope");
    wirePinFetch({ ok: true, json: async () => ({ authToken: "tok" }) });
    await startLinking();

    await tick(2000);

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        description: "Guardian could not link your Plex account",
      }),
    );
  });

  it("gives up when the PIN expires", async () => {
    wirePinFetch({ ok: true, json: async () => ({}) });
    await startLinking();

    await tick(600000);

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Plex Link Expired",
        description: "The Plex window timed out. Start again to retry.",
      }),
    );
  });

  it("stops watching once the popup is closed", async () => {
    wirePinFetch({ ok: true, json: async () => ({}) });
    await startLinking();

    popup.closed = true;
    await tick(500);

    expect(popup.close).not.toHaveBeenCalled();
  });
});

describe("EditProfileModal remaining edges", () => {
  it("sends a cleared avatar with the profile update", async () => {
    user = { ...admin, avatarUrl: "/old.png" };
    const { ui } = await renderModal();

    await ui.click(screen.getByRole("button", { name: /Delete/ }));
    await ui.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() =>
      expect(updateProfile).toHaveBeenCalledWith({ avatarUrl: "" }),
    );
  });

  it("falls back to a generic message when linking fails without one", async () => {
    fetchMock.mockImplementation((url: string) =>
      url === "/api/pg/auth/plex/pin"
        ? Promise.reject("nope")
        : Promise.resolve({ ok: true, json: async () => ({}) }),
    );
    const { ui } = await renderModal();
    await openTab(ui, "Plex");

    await ui.click(screen.getByRole("button", { name: /Link Plex Account/ }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Guardian could not link your Plex account",
        }),
      ),
    );
  });

  it("falls back to a generic message when unlinking fails without one", async () => {
    unlinkPlexAccount.mockRejectedValue("nope");
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ plexUserId: "p-1", plexUsername: "plexperson" }),
    });
    const { ui } = await renderModal();
    await openTab(ui, "Plex");

    await ui.click(
      await screen.findByRole("button", { name: /Unlink Plex Account/ }),
    );

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Failed to unlink Plex account",
        }),
      ),
    );
  });
});
