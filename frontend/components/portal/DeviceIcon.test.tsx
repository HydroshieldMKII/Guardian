import { render } from "@testing-library/react";
import { DeviceIcon } from "@/components/portal/DeviceIcon";

describe("DeviceIcon", () => {
  it.each([
    ["Android TV", "lucide-tv"],
    ["Roku", "lucide-tv"],
    ["Fire OS", "lucide-tv"],
    ["iOS", "lucide-smartphone"],
    ["Android", "lucide-smartphone"],
    ["Mobile Web", "lucide-smartphone"],
    ["iPadOS", "lucide-tablet"],
    ["Windows", "lucide-monitor"],
  ])("draws %s as %s", (platform, icon) => {
    const { container } = render(<DeviceIcon platform={platform} />);
    expect(container.querySelector("svg")).toHaveClass(icon);
  });
});
