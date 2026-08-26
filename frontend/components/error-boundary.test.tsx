import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "@/components/error-boundary";

const Boom = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) throw new Error("kaboom");
  return <div>recovered</div>;
};

let consoleError: jest.SpyInstance;

beforeEach(() => {
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("ErrorBoundary", () => {
  it("renders its children while nothing throws", () => {
    render(
      <ErrorBoundary>
        <div>all good</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText("all good")).toBeInTheDocument();
  });

  it("catches a render error and shows the message", () => {
    render(
      <ErrorBoundary>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("kaboom")).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(
      "ErrorBoundary caught an error:",
      expect.any(Error),
      expect.anything(),
    );
  });

  it("prefers a supplied fallback over the default card", () => {
    render(
      <ErrorBoundary fallback={<div>custom fallback</div>}>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByText("custom fallback")).toBeInTheDocument();
    expect(screen.queryByText("Something went wrong")).toBeNull();
  });

  it("retries and renders children again once they stop throwing", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ErrorBoundary>
        <Boom shouldThrow />
      </ErrorBoundary>,
    );

    rerender(
      <ErrorBoundary>
        <Boom shouldThrow={false} />
      </ErrorBoundary>,
    );
    await user.click(screen.getByRole("button", { name: /Try Again/ }));

    expect(screen.getByText("recovered")).toBeInTheDocument();
  });
});
