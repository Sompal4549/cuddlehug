import "server-only";
import type { Category, HomeContent, Paginated, ProductCard, ProductDetail, Review, StoreSettings } from "@/lib/types";

/** Server-side calls go straight to the backend (no CORS), independent of the browser proxy. */
const BASE = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000").replace(/\/$/, "");

async function getJson<T>(path: string, revalidate = 60): Promise<T | null> {
  try {
    const res = await fetch(`${BASE}/api${path}`, {
      next: { revalidate },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { success: boolean; data?: T };
    return (payload.data ?? null) as T | null;
  } catch {
    return null;
  }
}

export function getHomeContent() {
  return getJson<HomeContent>("/content/home", 30);
}

type QueryInput = string | Record<string, string | number | undefined>;

function toSearch(query: QueryInput): string {
  return typeof query === "string"
    ? query
    : new URLSearchParams(
        Object.entries(query)
          .filter(([, value]) => value !== undefined && value !== "" && value !== null)
          .map(([key, value]) => [key, String(value)]),
      ).toString();
}

export function getProductList(query: QueryInput, revalidate = 30) {
  return getJson<Paginated<ProductCard>>(`/products?${toSearch(query)}`, revalidate);
}

/** Same as `getProductList` but keeps the pagination `meta` from the envelope. */
export async function getProductListFull(
  query: QueryInput,
  revalidate = 30,
): Promise<{ items: ProductCard[]; meta: Paginated<ProductCard>["meta"] } | null> {
  try {
    const res = await fetch(`${BASE}/api/products?${toSearch(query)}`, {
      next: { revalidate },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as {
      success: boolean;
      data?: { items: ProductCard[] };
      meta?: Paginated<ProductCard>["meta"];
    };
    if (!payload.success || !payload.data) return null;
    return {
      items: payload.data.items ?? [],
      meta: payload.meta ?? { page: 1, limit: 12, total: payload.data.items?.length ?? 0, totalPages: 1 },
    };
  } catch {
    return null;
  }
}

export function getProduct(slug: string) {
  return getJson<ProductDetail>(`/products/${encodeURIComponent(slug)}`, 60);
}

export function getProductReviews(productId: string) {
  return getJson<{ items: Review[] }>(`/reviews/product/${productId}?limit=20`, 60);
}

export function getRelated(slug: string) {
  return getJson<{ items: ProductCard[] }>(`/products/${encodeURIComponent(slug)}/related?limit=4`, 60);
}

export async function getCategories() {
  const data = await getJson<{ items: Category[] }>("/categories", 300);
  return data?.items ?? null;
}

export function getStoreSettings() {
  return getJson<StoreSettings>("/settings", 300);
}

export { BASE as API_BASE };
