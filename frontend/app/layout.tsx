import type { Metadata } from "next";
import { Instrument_Sans, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/hooks/use-theme";
import { themeBootScript } from "@/lib/theme";
import { AuthProvider } from "@/contexts/auth-context";
import { AuthGuard } from "@/components/auth-guard";
import { AppProviders } from "@/components/app-providers";
import "./globals.css";

const uiFont = Instrument_Sans({
  variable: "--font-ui",
  subsets: ["latin"],
});

const dataFont = Geist_Mono({
  variable: "--font-data",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  description: "Monitor active streams and manage device access",
  icons: {
    icon: "/icon-192.png",
    shortcut: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Guardian",
  },
  manifest: "/manifest.json",
};

export const viewport = {
  width: "device-width",
  initialScale: 1.0,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f3" },
    { media: "(prefers-color-scheme: dark)", color: "#111112" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${uiFont.variable} ${dataFont.variable} antialiased`}
        suppressHydrationWarning
      >
        <title>Guardian</title>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
        <ThemeProvider defaultTheme="dark" storageKey="guardian-ui-theme">
          <AuthProvider>
            <AuthGuard>
              <AppProviders>{children}</AppProviders>
            </AuthGuard>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
