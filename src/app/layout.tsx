import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sans",
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

// `maximumScale: 1` + `userScalable: false` used to sit here. They fail
// WCAG 1.4.4 (Resize Text), and they do it in the app where it matters
// most: measurement grids are 12-13px, read off a phone, in shop light.
//
// The usual reason to set them is stopping iOS from zooming in when a
// field under 16px takes focus. That is addressed at the cause instead —
// `.input` is now 16px, as are the search and date fields — so the zoom
// no longer fires and pinch-zoom is available again.
export const viewport: Viewport = {
  themeColor: "#0F0F0F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <ServiceWorkerRegister />
        <div className="min-h-dvh bg-canvas flex justify-center">
          <div className="w-full max-w-[430px] sm:max-w-[600px] md:max-w-[700px] lg:max-w-[820px] min-h-dvh bg-bg shadow-2xl relative">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
