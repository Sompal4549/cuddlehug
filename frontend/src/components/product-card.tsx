"use client";

import * as React from "react";
import Link from "next/link";
import { Heart, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import { useSession } from "@/lib/session";
import { api } from "@/lib/api";
import { discountLabel, formatMoney } from "@/lib/format";
import type { ProductCard as ProductCardType } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Stars } from "@/components/ui/stars";
import { cn } from "@/lib/utils";

export function ProductCard({ product, priority = false }: { product: ProductCardType; priority?: boolean }) {
  const { addItem } = useCart();
  const { user } = useSession();
  const [adding, setAdding] = React.useState(false);
  const [wishlisted, setWishlisted] = React.useState(false);
  const [wishlistBusy, setWishlistBusy] = React.useState(false);

  const image = product.image ?? "/images/08_product_brown_teddy.jpg";
  const label = discountLabel(product.mrp, product.price);

  const quickAdd = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const variant = product.variants.find((item) => item.available > 0);
    if (!variant) {
      toast.error("This teddy is out of stock right now");
      return;
    }
    setAdding(true);
    try {
      await addItem(variant.id, 1);
      toast.success(`${product.name} added to your bag`);
    } catch {
      toast.error("Could not add to bag. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  const toggleWishlist = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!user) {
      toast.info("Sign in to save favourites");
      return;
    }
    setWishlistBusy(true);
    try {
      if (wishlisted) {
        await api.delete(`/wishlist/${product.id}`);
        setWishlisted(false);
        toast.success("Removed from wishlist");
      } else {
        await api.post("/wishlist", { productId: product.id });
        setWishlisted(true);
        toast.success("Saved to wishlist");
      }
    } catch {
      toast.error("Could not update wishlist");
    } finally {
      setWishlistBusy(false);
    }
  };

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-soft transition hover:-translate-y-1 hover:shadow-lift"
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={product.images[0]?.alt ?? product.name}
          loading={priority ? "eager" : "lazy"}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute left-3 top-3 flex flex-col gap-1.5">
          {label && <Badge variant="destructive">{label}</Badge>}
          {product.isBestSeller && <Badge variant="primary">Best seller</Badge>}
          {!product.inStock && <Badge variant="default">Sold out</Badge>}
        </div>
        <div className="absolute right-3 top-3 flex flex-col gap-2 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            aria-label="Add to wishlist"
            disabled={wishlistBusy}
            onClick={toggleWishlist}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full bg-card/95 shadow-soft transition hover:text-primary",
              wishlisted && "text-primary",
            )}
          >
            <Heart className="h-4 w-4" fill={wishlisted ? "currentColor" : "none"} />
          </button>
          <button
            type="button"
            aria-label="Add to bag"
            disabled={adding}
            onClick={quickAdd}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-card/95 shadow-soft transition hover:text-primary disabled:opacity-60"
          >
            <ShoppingBag className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{product.category.name}</p>
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{product.name}</h3>
        <div className="flex items-center gap-1.5">
          <Stars rating={product.ratingAverage} size={12} />
          <span className="text-xs text-muted-foreground">({product.reviewCount})</span>
        </div>
        <div className="mt-auto flex items-baseline gap-2 pt-1">
          <span className="text-base font-bold text-foreground">{formatMoney(product.price)}</span>
          <span className="text-xs text-muted-foreground line-through">{formatMoney(product.mrp)}</span>
        </div>
        {product.lowStock && <p className="text-xs font-medium text-warning">Only a few left</p>}
      </div>
    </Link>
  );
}
