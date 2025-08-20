import type { Metadata } from "next";
import Header from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal - Connect with people nearby",
  description: "A modern platform for connecting people nearby using real-time presence and location-based discovery.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-gradient-to-br from-neutral-50 via-white to-neutral-100 min-h-screen">
        <Header />
        {children}
      </body>
    </html>
  );
}
