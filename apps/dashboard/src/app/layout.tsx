import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Chronicle - Multi-Agent Observability Dashboard",
  description: "Real-time observability dashboard for Claude Code agent activities across multiple projects and sessions",
  keywords: ["observability", "dashboard", "claude code", "agent monitoring", "real-time"],
  authors: [{ name: "Chronicle Team" }],
  creator: "Chronicle",
  openGraph: {
    title: "Chronicle - Multi-Agent Observability Dashboard",
    description: "Real-time observability dashboard for Claude Code agent activities",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Chronicle - Multi-Agent Observability Dashboard",
    description: "Real-time observability dashboard for Claude Code agent activities",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.ico",
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-bg-primary text-text-primary min-h-screen`}
      >
        <div id="chronicle-dashboard" className="flex flex-col min-h-screen">
          {children}
        </div>
      </body>
    </html>
  );
}
