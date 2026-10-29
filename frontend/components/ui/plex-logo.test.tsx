import { render, screen } from "@testing-library/react";
import { PlexLogo } from "@/components/ui/plex-logo";

describe("PlexLogo", () => {
  it("draws the Plex mark at the requested size", () => {
    render(<PlexLogo className="h-4 w-4" />);

    const logo = screen.getByAltText("Plex");
    expect(logo).toHaveClass("h-4", "w-4");
    expect(logo.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
  });
});
