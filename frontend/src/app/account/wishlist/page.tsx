"use client";

import * as React from "react";
import Link from "next/link";
import { Heart, ShoppingBag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useCart } from "@/lib/cart";
import type { WishlistItem } from "@/lib/types";
import { discountLabel, formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Stars } from "@/components/ui/stars";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty";

export default function WishlistPage() {
  const [items, setItems] = React.useState<WishlistItem[] | null>(null);
  const { addItem } = useCart();

  React.useEffect(() => {
    api
      .get<{ items: WishlistItem[] }>("/wishlist", { query: { limit: 50 } })
      .then((data) => setItems(data.items))
      .catch(() => setItems([]));
  }, []);

  const remove = async (entry: WishlistItem) => {
    try {
      await api.delete(`/wishlist/${entry.product.id}`);
      setItems((prev) => (prev ?? []).filter((item) => item.id !== entry.id));
      toast.success("Removed from wishlist");
    } catch {
      toast.error("Could not remove");
    }
  };

  const add = async (entry: WishlistItem) => {
    if (!entry.product.variantId) {
      toast.error("That bear is out of stock");
      return;
    }
    try {
      await addItem(entry.product.variantId, 1);
      toast.success("Added to your bag");
    } catch {
      toast.error("Could not add to bag");
    }
  };

  if (items === null) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="aspect-[3/4] w-full" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <EmptyState
          icon="wishlist"
          title="Your wishlist is empty"
          description="Tap the heart on any teddy to keep it here for later."
          action={
            <Link href="/shop">
              <Button>Browse teddies</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">Wishlist</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {items.map((entry) => (
          <article key={entry.id} className="group overflow-hidden rounded-lg border border-border bg-card">
            <Link href={`/products/${entry.product.slug}`} className="block">
              <div className="relative aspect-square bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={entry.product.image ?? "/images/09_product_pink_teddy.jpg"}
                  alt={entry.product.name}
                  className="h-full w-full object-cover transition group-hover:scale-105"
                />
                {!entry.product.inStock && (
                  <div className="absolute left-2 top-2">
                    <Badge variant="default">Sold out</Badge>
                  </div>
                )}
              </div>
            </Link>
            <div className="space-y-1.5 p-3">
              <Link href={`/products/${entry.product.slug}`} className="line-clamp-2 text-sm font-semibold hover:text-primary">
                {entry.product.name}
              </Link>
              <div className="flex items-center gap-1.5">
                <Stars rating={entry.product.ratingAverage} size={12} />
                <span className="text-xs text-muted-foreground">({entry.product.ratingCount})</span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-bold">{formatMoney(entry.product.price)}</span>
                <span className="text-xs text-muted-foreground line-through">{formatMoney(entry.product.mrp)}</span>
                {entry.product.discountPercent > 0 && (
                  <span className="text-xs font-semibold text-success">
                    {discountLabel(entry.product.mrp, entry.product.price)}
                  </span>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => void add(entry)} disabled={!entry.product.inStock}>
                  <ShoppingBag className="h-3.5 w-3.5" /> Add to bag
                </Button>
                <Button size="iconSm" variant="ghost" aria-label="Remove from wishlist" onClick={() => void remove(entry)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Heart className="h-3.5 w-3.5" /> {items.length} saved for later
      </p>
    </div>
  );
}
