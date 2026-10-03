import type { Metadata } from "next";
import { getCategories, getProductListFull } from "@/lib/server-api";
import { ShopView, type ShopFilters } from "@/components/shop/shop-view";
import { shopQuery } from "@/lib/shop-query";
import { EmptyState } from "@/components/ui/empty";

export const metadata: Metadata = {
  title: "Shop soft teddy bears",
  description:
    "Browse classic, giant, mini and couple teddy bears from CuddleHug. Filter by size, colour, price and availability.",
};

type Params = Record<string, string | string[] | undefined>;

function pick(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const filters: ShopFilters = {
    search: pick(params.search),
    category: pick(params.category),
    size: pick(params.size),
    color: pick(params.color),
    minPrice: pick(params.minPrice),
    maxPrice: pick(params.maxPrice),
    availability: pick(params.availability),
    sort: pick(params.sort),
    page: Number(pick(params.page)) || 1,
  };

  const [products, categories] = await Promise.all([
    getProductListFull(shopQuery({ ...filters, limit: 12 })),
    getCategories(),
  ]);

  if (!products || !categories) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24">
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icon="search"
            title="The shelf is unreachable right now"
            description="We could not load the catalogue. Please refresh the page in a few seconds."
          />
        </div>
      </div>
    );
  }

  return <ShopView initial={products} categories={categories} filters={filters} />;
}
