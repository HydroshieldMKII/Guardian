import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const setup = () => userEvent.setup({ pointerEventsCheck: 0 });

describe("Dialog", () => {
  it("opens from a trigger and renders every part", async () => {
    const user = setup();
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Heading</DialogTitle>
            <DialogDescription>Detail</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose>Dismiss</DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );

    await user.click(screen.getByRole("button", { name: "Open" }));

    expect(screen.getByText("Heading")).toBeInTheDocument();
    expect(screen.getByText("Detail")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() => expect(screen.queryByText("Heading")).toBeNull());
  });

  it("leaves closing to the dialog's own controls", async () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>No close</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });

  it("can still opt into a built-in close button", async () => {
    render(
      <Dialog open>
        <DialogContent showCloseButton>
          <DialogTitle>With close</DialogTitle>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("renders a standalone overlay in a portal", () => {
    render(
      <Dialog open>
        <DialogPortal>
          <DialogOverlay className="custom-overlay" />
        </DialogPortal>
      </Dialog>,
    );

    expect(document.querySelector(".custom-overlay")).not.toBeNull();
  });

  it("merges custom classes on header and footer", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader className="custom-header">
            <DialogTitle className="custom-title">Heading</DialogTitle>
            <DialogDescription className="custom-description">
              Detail
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="custom-footer" />
        </DialogContent>
      </Dialog>,
    );

    for (const cls of [
      "custom-header",
      "custom-title",
      "custom-description",
      "custom-footer",
    ]) {
      expect(document.querySelector(`.${cls}`)).not.toBeNull();
    }
  });
});

describe("DropdownMenu", () => {
  it("renders every kind of item", async () => {
    const user = setup();
    const onSelect = jest.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Section</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={onSelect}>
              Plain
              <DropdownMenuShortcut>⌘P</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem inset>Inset</DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuCheckboxItem checked>Checked</DropdownMenuCheckboxItem>
          <DropdownMenuRadioGroup value="a">
            <DropdownMenuRadioItem value="a">Radio A</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Nested</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Menu" }));

    expect(await screen.findByText("Section")).toBeInTheDocument();
    expect(screen.getByText("Checked")).toBeInTheDocument();
    expect(screen.getByText("Radio A")).toBeInTheDocument();
    expect(screen.getByText("⌘P")).toBeInTheDocument();

    await user.click(screen.getByText("Plain"));
    expect(onSelect).toHaveBeenCalled();
  });

  it("opens a submenu", async () => {
    const user = setup();
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger inset>More</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="custom-sub">
              <DropdownMenuItem>Nested</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(await screen.findByText("More"));

    expect(await screen.findByText("Nested")).toBeInTheDocument();
  });

  it("merges custom classes", async () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
        <DropdownMenuContent className="custom-content">
          <DropdownMenuLabel className="custom-label" inset>
            Section
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="custom-separator" />
          <DropdownMenuItem className="custom-item">Plain</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    for (const cls of [
      "custom-content",
      "custom-label",
      "custom-separator",
      "custom-item",
    ]) {
      expect(
        await waitFor(() => document.querySelector(`.${cls}`)),
      ).not.toBeNull();
    }
  });
});

describe("Popover", () => {
  it("opens from a trigger", async () => {
    const user = setup();
    render(
      <Popover>
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent>Popover body</PopoverContent>
      </Popover>,
    );

    await user.click(screen.getByRole("button", { name: "Open" }));

    expect(await screen.findByText("Popover body")).toBeInTheDocument();
  });

  it("accepts an anchor, alignment and custom class", async () => {
    render(
      <Popover open>
        <PopoverAnchor />
        <PopoverTrigger>Open</PopoverTrigger>
        <PopoverContent align="start" sideOffset={12} className="custom-pop">
          Anchored
        </PopoverContent>
      </Popover>,
    );

    expect(await screen.findByText("Anchored")).toBeInTheDocument();
    expect(document.querySelector(".custom-pop")).not.toBeNull();
  });
});

describe("Select", () => {
  it("opens and picks an option", async () => {
    const onValueChange = jest.fn();
    const user = setup();
    render(
      <Select onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Group</SelectLabel>
            <SelectItem value="a">Option A</SelectItem>
            <SelectSeparator />
            <SelectItem value="b">Option B</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>,
    );

    await user.click(screen.getByRole("combobox"));

    expect(await screen.findByText("Group")).toBeInTheDocument();

    await user.click(screen.getByText("Option B"));

    expect(onValueChange).toHaveBeenCalledWith("b");
  });

  it("renders a small trigger and a popper-positioned list", async () => {
    render(
      <Select open>
        <SelectTrigger size="sm" className="custom-trigger">
          <SelectValue placeholder="Pick" />
        </SelectTrigger>
        <SelectContent position="popper" className="custom-content">
          <SelectItem value="a">Option A</SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(document.querySelector(".custom-trigger")).not.toBeNull();
    expect(await screen.findByText("Option A")).toBeInTheDocument();
  });
});
