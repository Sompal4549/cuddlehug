"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Package,
  Percent,
  ScrollText,
  Settings,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react";
import { useSession } from "@/lib/session";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: ListChecks },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/coupons", label: "Coupons", icon: Percent },
  { href: "/admin/reviews", label: "Reviews", icon: MessageSquare },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/audit-logs", label: "Audit log", icon: ScrollText },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, status } = useSession();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    if (status === "guest") router.replace("/login?next=/admin");
    if (status === "authenticated" && user && user.role !== "ADMIN") router.replace("/");
  }, [status, user, router]);

  React.useEffect(() => setOpen(false), [pathname]);

  if (status === "loading" || !user || user.role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-[1400px] gap-6 px-4 py-6 sm:px-6">
      <aside className="hidden w-56 shrink-0 md:block">
        <div className="sticky top-24 rounded-lg border border-border bg-card p-2">
          <p className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin</p>
          <nav className="flex flex-col gap-0.5">
            {nav.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition",
                    active ? "bg-primary/12 text-primary-dark" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-2 border-t border-border pt-2">
            <Link href="/" className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted">
              <Store className="h-4 w-4" /> View storefront
            </Link>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-4 flex items-center gap-3 md:hidden">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium"
          >
            {open ? "Hide menu" : "Admin menu"}
          </button>
          <Link href="/" className="text-sm font-medium text-primary">
            Storefront
          </Link>
        </div>

        {open && (
          <nav className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-border bg-card p-2 md:hidden">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
                  pathname === item.href ? "bg-primary/12 text-primary-dark" : "text-muted-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        )}

        {children}
      </div>
    </div>
  );
}
