import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ErrorBoundary } from "@/components/error-boundary";
import { Navbar } from "@/components/navbar";
import { GlobalVersionMismatchBanner } from "@/components/global-version-mismatch-banner";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/hooks/use-theme";
import { VersionProvider } from "@/contexts/version-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Guardian Dashboard",
  description: "Monitor active streams and manage device access",
  viewport:
    "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no",
  themeColor: "#0f172a",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Guardian",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('guardian-ui-theme') || 'dark';
                  document.documentElement.className = theme;
                } catch (e) {
                  document.documentElement.className = 'dark';
                }
              })();
            `,
          }}
        />
        <ThemeProvider defaultTheme="dark" storageKey="guardian-ui-theme">
          <VersionProvider>
            <ErrorBoundary>
              <GlobalVersionMismatchBanner />
              <Navbar />
              {children}
            </ErrorBoundary>
            <Toaster />
          </VersionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
