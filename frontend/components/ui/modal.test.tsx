import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  type ModalSize,
} from "@/components/ui/modal";

const SIZES: ModalSize[] = ["sm", "md", "lg", "xl"];

const renderModal = (
  props: Partial<React.ComponentProps<typeof Modal>> = {},
  header: React.ReactNode = <ModalHeader title="Device Details" />,
) => {
  const onOpenChange = jest.fn();
  const view = render(
    <Modal open onOpenChange={onOpenChange} {...props}>
      {header}
      <ModalBody>
        <p>body content</p>
      </ModalBody>
      <ModalFooter>
        <button>Close</button>
      </ModalFooter>
    </Modal>,
  );
  return { ...view, onOpenChange, user: userEvent.setup() };
};

describe("Modal", () => {
  it("renders nothing while closed", () => {
    render(
      <Modal open={false} onOpenChange={jest.fn()}>
        <ModalHeader title="Hidden" />
      </Modal>,
    );

    expect(screen.queryByText("Hidden")).toBeNull();
  });

  it("shows the header, body and footer", () => {
    renderModal();

    expect(
      screen.getByRole("heading", { name: "Device Details" }),
    ).toBeInTheDocument();
    expect(screen.getByText("body content")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Close" })).toHaveLength(1);
  });

  it.each(SIZES)("accepts the %s size", (size) => {
    renderModal({ size });
    expect(
      screen.getByRole("heading", { name: "Device Details" }),
    ).toBeInTheDocument();
  });

  it("lifts a nested modal above its parent", () => {
    renderModal({ nested: true });

    expect(
      document.querySelector('[data-slot="dialog-content"]')?.className,
    ).toContain("z-[999999]");
    expect(
      document.querySelector('[data-slot="dialog-overlay"]')?.className,
    ).toContain("z-[999999]");
  });

  it("stays at the default layer otherwise", () => {
    renderModal();

    expect(
      document.querySelector('[data-slot="dialog-overlay"]')?.className,
    ).not.toContain("z-[999999]");
  });

  it("reports a dismissal", async () => {
    const { user, onOpenChange } = renderModal();

    await user.keyboard("{Escape}");

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("accepts extra classes on each part", () => {
    render(
      <Modal open onOpenChange={jest.fn()} className="modal-extra">
        <ModalHeader title="Titled" className="header-extra" />
        <ModalBody className="body-extra">
          <p>body</p>
        </ModalBody>
        <ModalFooter className="footer-extra">
          <button>Close</button>
        </ModalFooter>
      </Modal>,
    );

    for (const extra of [
      "modal-extra",
      "header-extra",
      "body-extra",
      "footer-extra",
    ]) {
      expect(document.body.innerHTML).toContain(extra);
    }
  });
});

describe("ModalHeader", () => {
  it("shows a visible description when given one", () => {
    renderModal(
      {},
      <ModalHeader title="Device Details" description="Managed device" />,
    );

    expect(screen.getByText("Managed device")).toBeInTheDocument();
  });

  it("keeps an accessible description when none is given", () => {
    renderModal();

    const description = document.querySelector(
      '[data-slot="dialog-description"]',
    );
    expect(description?.className).toContain("sr-only");
    expect(description?.textContent).toBe("Device Details");
  });

  it("renders extra header children", () => {
    renderModal(
      {},
      <ModalHeader title="Device Details">
        <input placeholder="Search" />
      </ModalHeader>,
    );

    expect(screen.getByPlaceholderText("Search")).toBeInTheDocument();
  });
});

describe("ModalBody", () => {
  it("exposes its scroll container through a ref", () => {
    const ref = { current: null as HTMLDivElement | null };

    render(
      <Modal open onOpenChange={jest.fn()}>
        <ModalHeader title="Titled" />
        <ModalBody ref={ref}>
          <p>body</p>
        </ModalBody>
      </Modal>,
    );

    expect(ref.current).toBeInstanceOf(HTMLDivElement);
    expect(ref.current?.className).toContain("overflow-y-auto");
  });

  it("keeps its scrollbar on show, so more content below is never hidden", () => {
    const ref = { current: null as HTMLDivElement | null };

    render(
      <Modal open onOpenChange={jest.fn()}>
        <ModalHeader title="Titled" />
        <ModalBody ref={ref}>
          <p>body</p>
        </ModalBody>
      </Modal>,
    );

    expect(ref.current?.className).toContain("scrollbar-visible");
  });
});
