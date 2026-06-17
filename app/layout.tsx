import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Smart Voice Note",
  description: "Aplikasi Voice Note Pintar Multi-Bahasa",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}