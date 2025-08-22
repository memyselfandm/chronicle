import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { DashboardErrorBoundary } from "@/components/ErrorBoundary";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Chronicle Observability",
  description: "Real-time observability platform for Claude Code agent activities across multiple projects and sessions",
  keywords: ["observability", "monitoring", "claude code", "agent analytics", "real-time"],
  authors: [{ name: "Chronicle Team" }],
  creator: "Chronicle",
  openGraph: {
    title: "Chronicle Observability",
    description: "Real-time observability platform for Claude Code agent activities",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Chronicle Observability",
    description: "Real-time observability platform for Claude Code agent activities",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-bg-primary text-text-primary min-h-screen`}
      >
        <div id="chronicle-dashboard" className="flex flex-col min-h-screen">
          <DashboardErrorBoundary>
            {children}
          </DashboardErrorBoundary>
        </div>
      </body>
    </html>
  );
}
