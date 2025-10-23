import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ErrorBoundary } from "@/components/error-boundary";
import { Navbar } from "@/components/navbar";
import { GlobalVersionMismatchBanner } from "@/components/global-version-mismatch-banner";
import { GlobalUpdateBanner } from "@/components/global-update-banner";
import { GlobalNotificationHandler } from "@/components/global-notification-handler";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/hooks/use-theme";
import { VersionProvider } from "@/contexts/version-context";
import { NotificationProvider } from "@/contexts/notification-context";
import { SettingsProvider } from "@/contexts/settings-context";
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
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
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
            <NotificationProvider>
              <SettingsProvider>
                <ErrorBoundary>
                  <GlobalVersionMismatchBanner />
                  <GlobalUpdateBanner />
                  <Navbar />
                  <GlobalNotificationHandler />
                  {children}
                </ErrorBoundary>
                <Toaster />
              </SettingsProvider>
            </NotificationProvider>
          </VersionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
