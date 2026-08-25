import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";
import { Toaster } from "@/components/ui/toaster";
import { toast as fireToast } from "@/hooks/use-toast";

const renderToast = (props: Record<string, unknown> = {}) =>
  render(
    <ToastProvider>
      <Toast open {...props}>
        <ToastTitle>Saved</ToastTitle>
        <ToastDescription>Everything worked</ToastDescription>
        <ToastAction altText="Undo it">Undo</ToastAction>
        <ToastClose />
      </Toast>
      <ToastViewport />
    </ToastProvider>,
  );

describe("Toast", () => {
  it("renders title, description and actions", () => {
    renderToast();

    expect(screen.getByText("Saved")).toBeInTheDocument();
    expect(screen.getByText("Everything worked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });

  it.each(["default", "destructive", "success", "warning"] as const)(
    "renders the %s variant",
    (variant) => {
      renderToast({ variant });
      expect(screen.getByText("Saved")).toBeInTheDocument();
    },
  );

  it("merges a custom class on the viewport", () => {
    const { container } = render(
      <ToastProvider>
        <ToastViewport className="custom-viewport" />
      </ToastProvider>,
    );
    expect(container.innerHTML).toContain("custom-viewport");
  });

  it("closes when dismissed", async () => {
    const onOpenChange = jest.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderToast({ onOpenChange });

    const close = document.querySelector("[toast-close]") as HTMLElement;
    await user.click(close);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("Toaster", () => {
  it("renders nothing while there are no toasts", () => {
    const { container } = render(<Toaster />);
    expect(container.querySelectorAll("li")).toHaveLength(0);
  });

  it("renders a queued toast with its title and description", async () => {
    render(<Toaster />);

    await act(async () => {
      fireToast({ title: "Queued", description: "From the hook" });
    });

    expect(await screen.findByText("Queued")).toBeInTheDocument();
    expect(screen.getByText("From the hook")).toBeInTheDocument();
  });

  it("renders a toast with only a title", async () => {
    render(<Toaster />);

    await act(async () => {
      fireToast({ title: "Title only" });
    });

    expect(await screen.findByText("Title only")).toBeInTheDocument();
  });

  it("renders a toast with only a description", async () => {
    render(<Toaster />);

    await act(async () => {
      fireToast({ description: "Description only" });
    });

    expect(await screen.findByText("Description only")).toBeInTheDocument();
  });

  it("renders a supplied action", async () => {
    render(<Toaster />);

    await act(async () => {
      fireToast({
        title: "With action",
        action: <ToastAction altText="Retry">Retry</ToastAction>,
      });
    });

    expect(
      await screen.findByRole("button", { name: "Retry" }),
    ).toBeInTheDocument();
  });
});
