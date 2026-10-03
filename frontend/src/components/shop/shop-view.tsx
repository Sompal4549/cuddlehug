"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";
import { api } from "@/lib/api";
import type { Category, Paginated, ProductCard as ProductCardType } from "@/lib/types";
import { ProductCard } from "@/components/product-card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty";
import { ProductCardSkeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { shopQuery, type ShopFilters as Filters } from "@/lib/shop-query";

const SIZES = ["MINI", "SMALL", "MEDIUM", "LARGE", "GIANT"];
const COLORS: { value: string; hex: string }[] = [
  { value: "BROWN", hex: "#8a5a3b" },
  { value: "PINK", hex: "#f0a7b8" },
  { value: "WHITE", hex: "#f6f1ea" },
  { value: "CREAM", hex: "#efe0c8" },
  { value: "RED", hex: "#d64545" },
];

const SORT_OPTIONS = [
  { value: "relevance", label: "Relevance" },
  { value: "bestselling", label: "Best selling" },
  { value: "newest", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
  { value: "discount", label: "Biggest discount" },
];

export function ShopView({
  initial,
  categories,
  filters,
}: {
  initial: Paginated<ProductCardType>;
  categories: Category[];
  filters: Filters;
}) {
  const router = useRouter();
  const [data, setData] = React.useState<Paginated<ProductCardType>>(initial);
  const [loading, setLoading] = React.useState(false);
  const [drawer, setDrawer] = React.useState(false);
  const [state, setState] = React.useState<Filters>(filters);
  const [pendingPrice, setPendingPrice] = React.useState({ min: filters.minPrice ?? "", max: filters.maxPrice ?? "" });

  const apply = React.useCallback(
    (next: Filters) => {
      const merged: Filters = { ...state, ...next };
      if (next.page === undefined) merged.page = 1;
      setState(merged);
      setDrawer(false);
      setLoading(true);

      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(shopQuery(merged))) {
        if (value !== undefined && value !== "" && value !== 1) params.set(key, String(value));
      }
      if (merged.page && merged.page > 1) params.set("page", String(merged.page));
      const query = params.toString();
      router.replace(query ? `/shop?${query}` : "/shop", { scroll: false });

      api
        .getFull<{ items: ProductCardType[] }>("/products", { query: shopQuery(merged) })
        .then(({ data, meta }) =>
          setData({
            items: data.items,
            meta: (meta ?? { page: 1, limit: 12, total: data.items.length, totalPages: 1 }) as Paginated<ProductCardType>["meta"],
          }),
        )
        .finally(() => setLoading(false));
    },
    [state, router],
  );

  const reset = () => {
    setPendingPrice({ min: "", max: "" });
    apply({ category: "", size: "", color: "", minPrice: "", maxPrice: "", availability: "", search: "" });
  };

  const activeCount = ["category", "size", "color", "minPrice", "maxPrice", "search"].filter((key) =>
    Boolean(state[key as keyof Filters]),
  ).length;

  const filterPanel = (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Search</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get("search");
            apply({ search: String(value ?? "").trim() });
          }}
        >
          <Input name="search" defaultValue={state.search ?? ""} placeholder="Search teddies" />
        </form>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Category</p>
        <div className="flex flex-col gap-1">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => apply({ category: state.category === category.slug ? "" : category.slug })}
              className={cn(
                "flex items-center justify-between rounded-md px-2.5 py-2 text-sm transition",
                state.category === category.slug ? "bg-primary/12 font-semibold text-primary-dark" : "hover:bg-muted",
              )}
            >
              <span>{category.name}</span>
              <span className="text-xs text-muted-foreground">{category.productCount}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Size</p>
        <div className="flex flex-wrap gap-2">
          {SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => apply({ size: state.size === size ? "" : size })}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-semibold uppercase transition",
                state.size === size ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary",
              )}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Colour</p>
        <div className="flex flex-wrap gap-2">
          {COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              title={color.value}
              aria-label={color.value}
              onClick={() => apply({ color: state.color === color.value ? "" : color.value })}
              className={cn(
                "h-7 w-7 rounded-full border-2 transition",
                state.color === color.value ? "border-primary ring-2 ring-ring/40" : "border-border",
              )}
              style={{ background: color.hex }}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Price</p>
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            apply({ minPrice: pendingPrice.min, maxPrice: pendingPrice.max });
          }}
        >
          <Input
            inputMode="numeric"
            placeholder="Min"
            value={pendingPrice.min}
            onChange={(event) => setPendingPrice((prev) => ({ ...prev, min: event.target.value }))}
          />
          <span className="text-muted-foreground">–</span>
          <Input
            inputMode="numeric"
            placeholder="Max"
            value={pendingPrice.max}
            onChange={(event) => setPendingPrice((prev) => ({ ...prev, max: event.target.value }))}
          />
          <Button type="submit" size="sm" variant="outline">
            Go
          </Button>
        </form>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Availability</p>
        <Select
          value={state.availability ?? "all"}
          onChange={(event) => apply({ availability: event.target.value })}
          options={[
            { value: "all", label: "Show all" },
            { value: "in_stock", label: "In stock only" },
            { value: "out_of_stock", label: "Out of stock" },
          ]}
        />
      </div>

      {activeCount > 0 && (
        <Button variant="ghost" size="sm" onClick={reset} className="justify-start">
          <X className="h-4 w-4" /> Clear all filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold sm:text-3xl">
          {state.search ? `Results for “${state.search}”` : state.category ? categories.find((c) => c.slug === state.category)?.name ?? "Shop" : "All teddies"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {data.meta.total} {data.meta.total === 1 ? "teddy" : "teddies"} found
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-lg border border-border bg-card p-4">{filterPanel}</div>
        </aside>

        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setDrawer(true)}>
              <SlidersHorizontal className="h-4 w-4" /> Filters{activeCount > 0 ? ` (${activeCount})` : ""}
            </Button>
            <div className="ml-auto w-52">
              <Select
                aria-label="Sort by"
                value={state.sort ?? "relevance"}
                onChange={(event) => apply({ sort: event.target.value })}
                options={SORT_OPTIONS}
              />
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <ProductCardSkeleton key={index} />
              ))}
            </div>
          ) : data.items.length === 0 ? (
            <div className="rounded-lg border border-border bg-card">
              <EmptyState
                icon="search"
                title="No teddies match those filters"
                description="Try widening the price range or clearing a filter or two."
                action={
                  <Button variant="outline" onClick={reset}>
                    Clear filters
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
              {data.items.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

          <div className="mt-8">
            <Pagination
              page={data.meta.page}
              totalPages={data.meta.totalPages}
              onChange={(page) => apply({ page })}
            />
          </div>
        </section>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button type="button" aria-label="Close filters" className="flex-1 bg-foreground/45" onClick={() => setDrawer(false)} />
          <div className="w-[85%] max-w-sm overflow-y-auto border-l border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-semibold">Filters</p>
              <button type="button" aria-label="Close" onClick={() => setDrawer(false)} className="rounded p-1 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            {filterPanel}
            <div className="sticky bottom-0 mt-6">
              <Button className="w-full" onClick={() => setDrawer(false)}>
                Show {data.meta.total} results
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export type { Filters as ShopFilters };
