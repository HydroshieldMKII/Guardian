import { render, screen } from "@testing-library/react";
import { Separator } from "@/components/ui/separator";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

describe("Separator", () => {
  it("defaults to a decorative horizontal rule", () => {
    const { container } = render(<Separator />);
    const el = container.querySelector('[data-slot="separator"]');

    expect(el).toHaveAttribute("data-orientation", "horizontal");
  });

  it("can be vertical and non-decorative", () => {
    const { container } = render(
      <Separator orientation="vertical" decorative={false} />,
    );
    const el = container.querySelector('[data-slot="separator"]');

    expect(el).toHaveAttribute("data-orientation", "vertical");
    expect(el).toHaveAttribute("role", "separator");
  });

  it("merges a custom class", () => {
    const { container } = render(<Separator className="my-8" />);
    expect(container.querySelector(".my-8")).not.toBeNull();
  });
});

describe("ScrollArea", () => {
  it("renders its children inside a viewport", () => {
    const { container } = render(
      <ScrollArea>
        <p>scrollable content</p>
      </ScrollArea>,
    );

    expect(screen.getByText("scrollable content")).toBeInTheDocument();
    expect(
      container.querySelector('[data-slot="scroll-area-viewport"]'),
    ).not.toBeNull();
  });

  it("merges a custom class", () => {
    const { container } = render(<ScrollArea className="h-40" />);
    expect(container.querySelector(".h-40")).not.toBeNull();
  });
});

describe("Table", () => {
  it("renders a full table", () => {
    render(
      <Table className="w-full">
        <TableCaption>Sessions</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Device</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Living Room TV</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>1 device</TableCell>
          </TableRow>
        </TableFooter>
      </Table>,
    );

    expect(screen.getByText("Sessions")).toBeInTheDocument();
    expect(screen.getByRole("columnheader")).toHaveTextContent("Device");
    expect(screen.getByText("Living Room TV")).toBeInTheDocument();
    expect(screen.getByText("1 device")).toBeInTheDocument();
  });

  it("tags each part with a slot", () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>x</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    for (const slot of ["table", "table-body", "table-row", "table-cell"]) {
      expect(container.querySelector(`[data-slot="${slot}"]`)).not.toBeNull();
    }
  });
});

describe("Badge", () => {
  it.each(["default", "secondary", "destructive", "outline"] as const)(
    "renders the %s variant",
    (variant) => {
      render(<Badge variant={variant}>Status</Badge>);
      expect(screen.getByText("Status")).toBeInTheDocument();
    },
  );

  it("can render as a child element", () => {
    render(
      <Badge asChild>
        <a href="/x">Linked</a>
      </Badge>,
    );
    expect(screen.getByRole("link", { name: "Linked" })).toBeInTheDocument();
  });
});

describe("Button", () => {
  it.each([
    "default",
    "destructive",
    "outline",
    "secondary",
    "ghost",
    "link",
  ] as const)("renders the %s variant", (variant) => {
    render(<Button variant={variant}>Press</Button>);
    expect(screen.getByRole("button", { name: "Press" })).toBeInTheDocument();
  });

  it.each(["default", "sm", "lg", "icon"] as const)(
    "renders the %s size",
    (size) => {
      render(<Button size={size}>Press</Button>);
      expect(screen.getByRole("button")).toBeInTheDocument();
    },
  );

  it("can render as a child element", () => {
    render(
      <Button asChild>
        <a href="/x">Go</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Go" })).toBeInTheDocument();
  });
});

describe("Card", () => {
  it("renders every part", () => {
    const { container } = render(
      <Card className="p-2">
        <CardHeader>
          <CardTitle>Title</CardTitle>
          <CardDescription>Description</CardDescription>
          <CardAction>
            <Button>Act</Button>
          </CardAction>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>,
    );

    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByText("Body")).toBeInTheDocument();
    expect(screen.getByText("Footer")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="card-action"]')).not.toBeNull();
  });
});
