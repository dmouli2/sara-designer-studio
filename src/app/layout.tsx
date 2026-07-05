import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  variable: "--font-display",
  display: "swap",
});

// metadataBase makes the og:image URL absolute — WhatsApp/social link
// previews (e.g. the customer tracking link) ignore relative image URLs.
// src/app/icon.png (Sara logo) is picked up automatically as the favicon.
export const metadata: Metadata = {
  metadataBase: new URL("https://sara-designer-studio.vercel.app"),
  title: "Sara Designer Studio",
  description: "Boutique order management",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Sara Studio" },
  icons: {
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Sara Designer Studio",
    description: "Boutique order management",
    siteName: "Sara Designer Studio",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "Sara Designer Studio" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0F0F0F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body>
        <ServiceWorkerRegister />
        <div className="min-h-screen bg-[#E8E4DA] flex justify-center">
          <div className="w-full max-w-[430px] sm:max-w-[600px] md:max-w-[700px] lg:max-w-[820px] min-h-screen bg-[#F9F8F6] shadow-2xl relative">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
