import type { ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LogoMark } from "@/components/ui/logo-mark";
import { useTheme } from "@/hooks/use-theme";

export function BrandedAuthPage({
  description,
  children,
}: {
  description: string;
  children: ReactNode;
}) {
  const { theme, toggleTheme } = useTheme();
  const ThemeIcon = theme === "dark" ? Sun : Moon;

  return (
    <div className="flex items-center justify-center h-screen bg-gradient-to-b from-background to-muted p-4 overflow-hidden relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleTheme}
        className="absolute top-4 right-4 h-9 w-9 p-0 hover:bg-accent/50 z-10"
      >
        <ThemeIcon className="h-4 w-4" />
        <span className="sr-only">Toggle theme</span>
      </Button>

      <Card className="w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="space-y-1 text-center pb-6 pt-8">
          <CardTitle className="flex items-center justify-center gap-3 text-3xl font-bold">
            <LogoMark className="h-9 w-auto" />
            Guardian
          </CardTitle>
          <CardDescription className="text-sm">{description}</CardDescription>
        </CardHeader>

        <CardContent className="pb-6">{children}</CardContent>
      </Card>
    </div>
  );
}
