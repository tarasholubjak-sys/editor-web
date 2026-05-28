import type { Metadata } from "next";
import { Onest } from "next/font/google";
import "./globals.css";

const onest = Onest({ subsets: ["latin", "cyrillic"], variable: "--font-onest" });

export const metadata: Metadata = {
  title: "Selfy Knowledge Editor",
  description: "AI-редактор бази знань Selfy: перетворює сирі документи у структуровані статті для Outline",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" className={onest.variable}>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
