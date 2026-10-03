import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { absoluteUrl } from "@/lib/utils";
import "./globals.css";

const siteName = process.env.NEXT_PUBLIC_STORE_NAME ?? "CuddleHug";

export const metadata: Metadata = {
  metadataBase: new URL(absoluteUrl()),
  title: {
    default: `${siteName} — Soft Teddy Bears & Plush Gifts`,
    template: `%s | ${siteName}`,
  },
  description:
    "CuddleHug crafts soft, huggable teddy bears for every occasion. Shop classic, giant, mini and couple teddy bears with fast delivery across India.",
  applicationName: siteName,
  keywords: ["teddy bear", "plush toy", "soft toy", "gifting", "cuddlehug"],
  openGraph: {
    type: "website",
    siteName,
    title: `${siteName} — Soft Teddy Bears & Plush Gifts`,
    description: "More Happiness. More Hugs. Shop handcrafted teddy bears for every occasion.",
    url: absoluteUrl(),
  },
  twitter: { card: "summary_large_image", title: siteName, description: "More Happiness. More Hugs." },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </Providers>
      </body>
    </html>
  );
}
