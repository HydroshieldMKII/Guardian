import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PlexStatus } from "@/types";
import { ERROR_DISPLAY_CONFIG, PlexErrorCode } from "@/types/plex-errors";
import { ErrorHandler, PlexErrorHandler } from "@/components/error-handler";

const status = (overrides: Partial<PlexStatus> = {}): PlexStatus =>
  ({
    configured: true,
    hasValidCredentials: true,
    connectionStatus: "",
    ...overrides,
  }) as PlexStatus;

describe("ErrorHandler", () => {
  it("is also exported under its legacy name", () => {
    expect(PlexErrorHandler).toBe(ErrorHandler);
  });

  describe("backend errors", () => {
    it("takes priority over any Plex status", () => {
      render(
        <ErrorHandler
          backendError="Connection refused"
          plexStatus={status({ configured: false })}
        />,
      );

      expect(screen.getByText("Backend Connection Error")).toBeInTheDocument();
      expect(screen.getByText("Connection refused")).toBeInTheDocument();
    });

    it("offers a retry when one is supplied", async () => {
      const onRetry = jest.fn();
      const user = userEvent.setup();
      render(<ErrorHandler backendError="down" onRetry={onRetry} />);

      await user.click(
        screen.getByRole("button", { name: /Retry Connection/ }),
      );

      expect(onRetry).toHaveBeenCalled();
    });

    it("falls back to the settings button when no retry is supplied", async () => {
      const onShowSettings = jest.fn();
      const user = userEvent.setup();
      render(
        <ErrorHandler backendError="down" onShowSettings={onShowSettings} />,
      );

      await user.click(screen.getByRole("button", { name: /Go to settings/ }));

      expect(onShowSettings).toHaveBeenCalled();
    });

    it("renders no action at all when neither callback is supplied", () => {
      render(<ErrorHandler backendError="down" />);
      expect(screen.queryByRole("button")).toBeNull();
    });

    it.each([
      "Backend connection error: something",
      "Failed to fetch dashboard data",
      "Cannot connect to Guardian backend",
      "Backend server is not reachable",
    ])("recognises %p reported through the Plex status", (connectionStatus) => {
      render(<ErrorHandler plexStatus={status({ connectionStatus })} />);

      expect(screen.getByText("Backend Connection Error")).toBeInTheDocument();
      expect(
        screen.getByText(/Cannot communicate with the Guardian backend/),
      ).toBeInTheDocument();
    });

    it("does not offer a retry for a status-reported backend error", () => {
      render(
        <ErrorHandler
          plexStatus={status({
            connectionStatus: "Failed to fetch dashboard data",
          })}
          onRetry={jest.fn()}
        />,
      );

      expect(
        screen.queryByRole("button", { name: /Retry Connection/ }),
      ).toBeNull();
    });
  });

  it("shows the setup checklist when Plex is not configured", () => {
    render(<ErrorHandler plexStatus={status({ configured: false })} />);

    expect(
      screen.getByText(
        ERROR_DISPLAY_CONFIG[PlexErrorCode.NOT_CONFIGURED].title,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Plex Server IP Address")).toBeInTheDocument();
    expect(screen.getByText("Plex Server Port")).toBeInTheDocument();
    expect(screen.getByText("Plex Authentication Token")).toBeInTheDocument();
  });

  it("treats a missing status as unconfigured", () => {
    render(<ErrorHandler />);
    expect(screen.getByText("Not configured")).toBeInTheDocument();
  });

  describe("mapping backend error codes", () => {
    it.each([
      ["PLEX_CONNECTION_REFUSED:", PlexErrorCode.CONNECTION_REFUSED],
      ["PLEX_CONNECTION_TIMEOUT:", PlexErrorCode.CONNECTION_TIMEOUT],
      ["PLEX_AUTH_FAILED:", PlexErrorCode.AUTH_FAILED],
      ["PLEX_UNAUTHORIZED:", PlexErrorCode.AUTH_FAILED],
      ["PLEX_SSL_ERROR:", PlexErrorCode.SSL_ERROR],
      ["PLEX_CERT_ERROR:", PlexErrorCode.CERT_ERROR],
      ["PLEX_SERVER_ERROR:", PlexErrorCode.SERVER_ERROR],
      ["PLEX_NETWORK_ERROR:", PlexErrorCode.NETWORK_ERROR],
      ["PLEX_UNKNOWN_ERROR:", PlexErrorCode.UNKNOWN_ERROR],
    ])("renders the configured display for %s", (prefix, code) => {
      render(
        <ErrorHandler
          plexStatus={status({ connectionStatus: `${prefix} details` })}
        />,
      );

      expect(
        screen.getByText(ERROR_DISPLAY_CONFIG[code].title),
      ).toBeInTheDocument();
    });

    it("falls back for a status it does not recognise", () => {
      render(
        <ErrorHandler plexStatus={status({ connectionStatus: "who knows" })} />,
      );

      expect(
        screen.getByText("Oops! Something Went Wrong"),
      ).toBeInTheDocument();
      expect(screen.getByText("who knows")).toBeInTheDocument();
    });
  });

  describe("the connection status panel", () => {
    it("shows the raw connection status", () => {
      render(
        <ErrorHandler
          plexStatus={status({ connectionStatus: "PLEX_SERVER_ERROR: 500" })}
        />,
      );

      expect(screen.getByText("PLEX_SERVER_ERROR: 500")).toBeInTheDocument();
    });

    it("renders without any decorative icons", () => {
      const { container } = render(
        <ErrorHandler plexStatus={status({ configured: false })} />,
      );

      expect(container.querySelector("svg")).toBeNull();
    });
  });
});
