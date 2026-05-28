import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Selfy Knowledge Editor",
  description: "AI-редактор бази знань Selfy: перетворює сирі документи у структуровані статті для Outline",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
