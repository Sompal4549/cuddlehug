"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Heart, Menu, Search, ShoppingBag, User, X } from "lucide-react";
import { useSession } from "@/lib/session";
import { useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/shop", label: "Shop" },
  { href: "/shop?category=classic", label: "Classic" },
  { href: "/shop?category=giant", label: "Giant" },
  { href: "/shop?sort=newest", label: "New In" },
  { href: "/about", label: "About" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useSession();
  const { count } = useCart();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => {
    setOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    router.push(trimmed ? `/shop?search=${encodeURIComponent(trimmed)}` : "/shop");
    setSearchOpen(false);
    setOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <button
          type="button"
          className="rounded-md p-2 hover:bg-muted lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <Link href="/" className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.svg" alt="CuddleHug" className="h-9 w-auto" />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <form onSubmit={submitSearch} className="hidden items-center md:flex">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search teddies..."
                aria-label="Search products"
                className="h-10 w-52 rounded-md border border-input bg-card pl-9 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </form>

          <button
            type="button"
            aria-label="Search"
            className="rounded-md p-2 hover:bg-muted md:hidden"
            onClick={() => setSearchOpen((value) => !value)}
          >
            <Search className="h-5 w-5" />
          </button>

          <Link
            href={user ? "/account/wishlist" : "/login?next=/account/wishlist"}
            className="rounded-md p-2 hover:bg-muted"
            aria-label="Wishlist"
          >
            <Heart className="h-5 w-5" />
          </Link>

          <Link
            href={user ? "/account" : "/login"}
            className="hidden rounded-md p-2 hover:bg-muted sm:block"
            aria-label={user ? "Your account" : "Sign in"}
          >
            <User className="h-5 w-5" />
          </Link>

          <Link href="/cart" className="relative rounded-md p-2 hover:bg-muted" aria-label="Cart">
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
        </div>
      </div>

      {searchOpen && (
        <form onSubmit={submitSearch} className="border-t border-border px-4 py-3 md:hidden">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search teddies..."
            aria-label="Search products"
            className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </form>
      )}

      {open && (
        <div className="border-t border-border bg-card px-4 py-4 lg:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted"
              >
                {link.label}
              </Link>
            ))}
            <div className="my-2 h-px bg-border" />
            <Link href={user ? "/account" : "/login"} className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted">
              {user ? `Hi, ${user.firstName}` : "Sign in"}
            </Link>
            <Link href="/account/orders" className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted">
              Orders
            </Link>
            <Link href="/account/wishlist" className="rounded-md px-3 py-2.5 text-sm font-medium hover:bg-muted">
              Wishlist
            </Link>
            {user ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 justify-start"
                onClick={() => {
                  setOpen(false);
                  void logout();
                }}
              >
                Sign out
              </Button>
            ) : (
              <Link href="/register" className="mt-2">
                <Button size="sm" className="w-full">
                  Create account
                </Button>
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
