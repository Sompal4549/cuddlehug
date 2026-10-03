import Link from "next/link";
import { Camera, ThumbsUp, AtSign, Play, Mail, Phone, MapPin } from "lucide-react";

const columns = [
  {
    title: "Shop",
    links: [
      { href: "/shop", label: "All teddies" },
      { href: "/shop?category=classic", label: "Classic bears" },
      { href: "/shop?category=giant", label: "Giant bears" },
      { href: "/shop?category=mini", label: "Mini bears" },
      { href: "/shop?sort=price_asc", label: "Under ₹999" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/account/orders", label: "Track your order" },
      { href: "/shipping", label: "Shipping & delivery" },
      { href: "/returns", label: "Returns & refunds" },
      { href: "/faq", label: "FAQs" },
      { href: "/contact", label: "Contact us" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "Our story" },
      { href: "/care", label: "Care guide" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of service" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-16 border-t border-border bg-cream">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.svg" alt="CuddleHug" className="h-10 w-auto" />
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            More Happiness. More Hugs. Handmade teddy bears stitched from cloud-soft plush, built to be hugged for years.
          </p>
          <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4" /> hello@cuddlehug.com
            </p>
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4" /> +91 98765 43210
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4" /> CuddleHug Studios, Bengaluru, Karnataka
            </p>
          </div>
          <div className="mt-4 flex gap-2">
            {[
              { href: "https://instagram.com", icon: Camera, label: "Instagram" },
              { href: "https://facebook.com", icon: ThumbsUp, label: "Facebook" },
              { href: "https://x.com", icon: AtSign, label: "X" },
              { href: "https://youtube.com", icon: Play, label: "YouTube" },
            ].map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={social.label}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:border-primary hover:text-primary"
              >
                <social.icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        {columns.map((column) => (
          <div key={column.title}>
            <p className="text-sm font-semibold uppercase tracking-wide">{column.title}</p>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-muted-foreground transition hover:text-primary">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} CuddleHug. All rights reserved.</p>
          <p>Secure payments via Razorpay · UPI, cards, netbanking &amp; COD</p>
        </div>
      </div>
    </footer>
  );
}
