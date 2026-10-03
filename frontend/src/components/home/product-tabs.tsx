"use client";

import * as React from "react";
import { ProductCard } from "@/components/product-card";
import { Tabs, type TabItem } from "@/components/ui/tabs";
import { ProductCardSkeleton } from "@/components/ui/skeleton";
import type { ProductCard as ProductCardType } from "@/lib/types";

export function ProductTabs({
  featured,
  bestSellers,
  newArrivals,
}: {
  featured: ProductCardType[];
  bestSellers: ProductCardType[];
  newArrivals: ProductCardType[];
}) {
  const [value, setValue] = React.useState("featured");
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => setReady(true), []);

  const items: TabItem[] = [
    { value: "featured", label: "Featured" },
    { value: "bestsellers", label: "Best sellers" },
    { value: "new", label: "New arrivals" },
  ];

  const products = value === "featured" ? featured : value === "bestsellers" ? bestSellers : newArrivals;
  const visible = products.slice(0, 8);

  return (
    <div className="flex flex-col gap-6">
      <Tabs items={items} value={value} onChange={setValue} className="self-start" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
        {!ready
          ? Array.from({ length: 4 }).map((_, index) => <ProductCardSkeleton key={index} />)
          : visible.map((product, index) => <ProductCard key={product.id} product={product} priority={index < 4} />)}
      </div>
    </div>
  );
}
