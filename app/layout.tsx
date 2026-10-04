import type { Metadata } from "next";
import { Familjen_Grotesk, Fragment_Mono } from "next/font/google";
import "./globals.css";

const sans = Familjen_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-familjen",
});

const mono = Fragment_Mono({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-fragment",
});

export const metadata: Metadata = {
  title: "Nakrycie — plan posiłków",
  description: "Tydzień jedzenia z przepisami z bazy i cenami z katalogu Lidla oraz cennika budżetowego.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pl" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
