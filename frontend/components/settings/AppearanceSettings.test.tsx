import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { ThemeProvider } from "@/hooks/use-theme";

const root = document.documentElement;

const renderSettings = () => {
  render(
    <ThemeProvider>
      <AppearanceSettings />
    </ThemeProvider>,
  );
  return userEvent.setup();
};

beforeEach(() => {
  localStorage.clear();
  root.className = "";
  root.removeAttribute("data-palette");
});

describe("AppearanceSettings", () => {
  it("shows the current mode and palette", () => {
    renderSettings();

    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Graphite" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(
      screen
        .getAllByRole("radio")
        .map((radio) => radio.getAttribute("aria-label")),
    ).toEqual(["Graphite", "Warm", "Slate"]);
  });

  it("switches the mode", async () => {
    const user = renderSettings();

    await user.click(screen.getByRole("button", { name: "Light" }));

    expect(root.classList.contains("light")).toBe(true);
    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("offers an auto mode that follows the device", async () => {
    const user = renderSettings();

    await user.click(screen.getByRole("button", { name: "Auto" }));

    expect(localStorage.getItem("guardian-ui-theme")).toBe("system");
    expect(screen.getByRole("button", { name: "Auto" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(root.classList.contains("light")).toBe(true);
  });

  it("switches the palette", async () => {
    const user = renderSettings();

    await user.click(screen.getByRole("radio", { name: "Warm" }));

    expect(root.dataset.palette).toBe("warm");
    expect(screen.getByRole("radio", { name: "Warm" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Graphite" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("previews each palette in the current mode", async () => {
    const user = renderSettings();
    const preview = () => screen.getByTestId("palette-preview-slate");

    expect(preview()).toHaveStyle({ backgroundColor: "#0f141b" });

    await user.click(screen.getByRole("button", { name: "Light" }));

    expect(preview()).toHaveStyle({ backgroundColor: "#eef1f5" });
  });
});
