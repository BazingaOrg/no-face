import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "No Face - Privacy-focused Face Replacement",
  description: "Replace faces in images with emojis. All processing happens locally in your browser - no data upload.",
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
