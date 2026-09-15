import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";

import "@/app/globals.css";

const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-display"
});

const body = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body"
});

export const metadata: Metadata = {
  title: "Kal Nidre Raffle | Congregation Magen David of West Deal",
  description:
    "Buy tickets for the West Deal Shul Kal Nidre raffle. The winner holds the Sefer Torah during Kal Nidre, and every participant is included in the Rabbi's Mi Sheberach."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
