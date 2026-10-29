import { render } from "@testing-library/react";
import { UnsavedChangesBar } from "./UnsavedChangesBar";

const renderBar = () =>
  render(
    <UnsavedChangesBar
      isSaving={false}
      saveBlocked={false}
      onCancel={jest.fn()}
      onSave={jest.fn()}
    />,
  );

describe("UnsavedChangesBar placement", () => {
  it("sits above the phone tab bar", () => {
    const { container } = renderBar();

    expect(container.firstChild).toHaveClass(
      "bottom-[calc(4rem+env(safe-area-inset-bottom))]",
    );
  });

  it("keeps clear of the home indicator where there is no tab bar", () => {
    const { container } = renderBar();

    expect(container.firstChild).toHaveClass(
      "sm:bottom-0",
      "sm:pb-[env(safe-area-inset-bottom)]",
    );
  });
});
