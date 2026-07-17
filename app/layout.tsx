import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baseMetadata: Metadata = {
  title: "Flowcraft — Agent Workflow Studio",
  description: "Build, run, inspect, and control AI agents and deterministic workflows on a visual canvas.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const socialImage = new URL("/og.png", origin).toString();

  return {
    ...baseMetadata,
    metadataBase: new URL(origin),
    openGraph: {
      type: "website",
      title: "Flowcraft — Agent Workflow Studio",
      description: "Build, run, inspect, and control AI agents and deterministic workflows on a visual canvas.",
      images: [{ url: socialImage, width: 1200, height: 630, alt: "Flowcraft visual agent workflow studio" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Flowcraft — Agent Workflow Studio",
      description: "Build, run, inspect, and control AI agents and deterministic workflows on a visual canvas.",
      images: [socialImage],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
