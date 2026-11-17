import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SALON_CONFIG } from "../lib/salon-config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${SALON_CONFIG.fullName} | Grooming, Hair & Skin Studio in ${SALON_CONFIG.city}`,
  description: `${SALON_CONFIG.tagline}. Book grooming, hair, and skin services at ${SALON_CONFIG.address}.`,
  keywords: [
    `Best Salon in ${SALON_CONFIG.city}`,
    `barber in ${SALON_CONFIG.city}`,
    `hair salon ${SALON_CONFIG.city}`,
    `facial and grooming ${SALON_CONFIG.city}`,
    SALON_CONFIG.fullName,
  ],
  openGraph: {
    title: SALON_CONFIG.fullName,
    description: `${SALON_CONFIG.tagline} · Book your appointment on WhatsApp.`,
    type: "website",
    locale: "en_IN",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
