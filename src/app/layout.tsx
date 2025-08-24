import type { Metadata } from "next";
import Header from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal - Connect with people nearby",
  description: "A modern platform for connecting people nearby using real-time presence and location-based discovery.",
  icons: {
    icon: [
      { url: '/icon-180x180.svg', sizes: '180x180', type: 'image/svg+xml' },
      { url: '/icon-192x192.svg', sizes: '192x192', type: 'image/svg+xml' },
      { url: '/icon-512x512.svg', sizes: '512x512', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/icon-180x180.svg', sizes: '180x180', type: 'image/svg+xml' },
    ],
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="icon" type="image/svg+xml" href="/icon-180x180.svg" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/icon-180x180.svg" />
        <link rel="shortcut icon" href="/icon-180x180.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Signal" />
        <meta name="theme-color" content="#ffffff" />
      </head>
      <body className="h-full bg-gradient-to-br from-neutral-50 via-white to-neutral-100 min-h-screen">
        <Header />
        {children}
      </body>
    </html>
  );
}
