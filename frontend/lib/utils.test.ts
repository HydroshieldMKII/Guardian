import { cn } from "./utils";

describe("cn", () => {
  it("joins plain class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("drops falsy values", () => {
    expect(cn("a", false, null, undefined, "")).toBe("a");
  });

  it("applies conditional objects", () => {
    expect(cn("a", { b: true, c: false })).toBe("a b");
  });

  it("flattens arrays", () => {
    expect(cn(["a", "b"], "c")).toBe("a b c");
  });

  it("lets the later tailwind class win a conflict", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("keeps non-conflicting tailwind classes", () => {
    expect(cn("px-2", "py-4")).toBe("px-2 py-4");
  });

  it("returns an empty string with no input", () => {
    expect(cn()).toBe("");
  });
});
