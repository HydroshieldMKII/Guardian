import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AppSetting } from "@/types";
import { SecretInput } from "@/components/settings/SecretInput";

const setting = (overrides: Partial<AppSetting> = {}): AppSetting => ({
  id: 1,
  key: "SMTP_PASSWORD",
  value: "stored-secret",
  description: "",
  type: "string",
  private: true,
  updatedAt: "2026-01-01T00:00:00Z",
  ...overrides,
});

const renderInput = (
  props: Partial<React.ComponentProps<typeof SecretInput>> = {},
) => {
  const onChange = jest.fn();
  const view = render(
    <SecretInput
      setting={props.setting ?? setting()}
      value={props.value ?? "stored-secret"}
      placeholder={props.placeholder ?? "Enter smtp password"}
      type={props.type ?? "password"}
      onChange={props.onChange ?? onChange}
    />,
  );
  return { ...view, onChange, user: userEvent.setup() };
};

const clearButton = () => screen.queryByRole("button", { name: /^Clear / });

describe("SecretInput", () => {
  it("masks a saved secret rather than echoing it back", () => {
    renderInput();

    const field = screen.getByPlaceholderText("•••••••• (saved)");
    expect(field).toHaveValue("");
    expect(field).toHaveAttribute("type", "password");
  });

  it("offers a clear button while a secret is stored", () => {
    renderInput();

    expect(clearButton()).toBeInTheDocument();
  });

  it("empties the value when the clear button is pressed", async () => {
    const { user, onChange } = renderInput();

    await user.click(clearButton() as HTMLElement);

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("hides the clear button once there is nothing to clear", () => {
    renderInput({ value: "" });

    expect(clearButton()).toBeNull();
  });

  it("shows the ordinary placeholder after clearing, not the saved mask", () => {
    renderInput({ value: "" });

    expect(
      screen.getByPlaceholderText("Enter smtp password"),
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("•••••••• (saved)")).toBeNull();
  });

  it("offers to clear a freshly typed value too", () => {
    renderInput({ value: "typed-in" });

    expect(clearButton()).toBeInTheDocument();
    expect(screen.getByDisplayValue("typed-in")).toBeInTheDocument();
  });

  it("reports what the operator types", async () => {
    const { user, onChange } = renderInput({ value: "" });

    await user.type(screen.getByPlaceholderText("Enter smtp password"), "a");

    expect(onChange).toHaveBeenCalledWith("a");
  });

  it("does not mask a non-private setting", () => {
    renderInput({
      setting: setting({ key: "SMTP_HOST", private: false }),
      value: "mail.example.com",
      type: "text",
      placeholder: "Enter smtp host",
    });

    expect(screen.getByDisplayValue("mail.example.com")).toBeInTheDocument();
    expect(clearButton()).toBeInTheDocument();
  });

  it("names the field it clears so the control is distinguishable", () => {
    renderInput({ setting: setting({ key: "PLEX_TOKEN" }) });

    expect(
      screen.getByRole("button", { name: "Clear PLEX_TOKEN" }),
    ).toBeInTheDocument();
  });

  it("keeps the field reachable by its label id", () => {
    renderInput();

    expect(screen.getByPlaceholderText("•••••••• (saved)")).toHaveAttribute(
      "id",
      "SMTP_PASSWORD",
    );
  });
});
