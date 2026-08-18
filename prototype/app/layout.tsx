import type { Metadata } from "next";
import { Fraunces, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Shell } from "@/components/shell";
import { getCurrentPeriod } from "@/lib/periods";

/* Editorial-analytical type system:
   Fraunces — a high-contrast old-style serif carries headlines & display numerals.
   Hanken Grotesk — a refined humanist grotesk for body / UI text.
   IBM Plex Mono — every metric, score and id is set in mono for an instrument feel. */
const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  style: ["normal", "italic"],
  display: "swap",
});
const sans = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Hitopia · Monitoring & Monthly Report",
  description:
    "Quantitative performance monitoring + client-ready monthly reporting for Hitopia. Read-only dashboard prototype with a mock data layer matching the foundation contract.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const initialPeriod = getCurrentPeriod();

  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <Providers initialPeriod={initialPeriod}>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
