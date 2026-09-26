import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trip Decider",
  description: "Everyone adds their preferences once. The group gets three options and sees where each person stands.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#16213E" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <header className="topbar">
          <a href="/" className="brand">Trip Decider</a>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
