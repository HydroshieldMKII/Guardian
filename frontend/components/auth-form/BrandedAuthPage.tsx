import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LogoMark } from "@/components/ui/logo-mark";
import { AuthLayout, type AuthLayoutAlign } from "./AuthLayout";

export function BrandedAuthPage({
  description,
  align,
  children,
}: {
  description: string;
  align?: AuthLayoutAlign;
  children: ReactNode;
}) {
  return (
    <AuthLayout align={align}>
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 pt-8 pb-6 text-center">
          <CardTitle className="flex items-center justify-center gap-3 text-3xl font-bold">
            <LogoMark className="h-9 w-auto" />
            Guardian
          </CardTitle>
          <CardDescription className="text-sm">{description}</CardDescription>
        </CardHeader>

        <CardContent className="pb-6">{children}</CardContent>
      </Card>
    </AuthLayout>
  );
}
