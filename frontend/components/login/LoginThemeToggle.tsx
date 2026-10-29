import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoginThemeToggle({
  theme,
  onToggle,
}: {
  theme: string;
  onToggle: () => void;
}) {
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onToggle}
      className="absolute top-4 right-4 h-9 w-9 p-0 hover:bg-accent/50 z-10"
    >
      <Icon className="h-4 w-4" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
