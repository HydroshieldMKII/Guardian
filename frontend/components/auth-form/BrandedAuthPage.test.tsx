import { render, screen } from "@testing-library/react";
import { BrandedAuthPage } from "./BrandedAuthPage";

jest.mock("@/hooks/use-theme", () => ({
  useTheme: () => ({ theme: "dark", toggleTheme: jest.fn() }),
}));

describe("BrandedAuthPage", () => {
  it("brands the card and explains the page", () => {
    render(
      <BrandedAuthPage description="Sign in to your account">
        <p>form goes here</p>
      </BrandedAuthPage>,
    );

    expect(screen.getByText("Guardian")).toBeInTheDocument();
    expect(screen.getByText("Sign in to your account")).toBeInTheDocument();
    expect(screen.getByText("form goes here")).toBeInTheDocument();
  });
});
