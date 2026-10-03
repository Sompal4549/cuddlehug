export type ShopFilters = {
  search?: string;
  category?: string;
  size?: string;
  color?: string;
  minPrice?: string;
  maxPrice?: string;
  availability?: string;
  sort?: string;
  page?: number;
  limit?: number;
};

/** Maps filter state to the public product list query. */
export function shopQuery(filters: ShopFilters): Record<string, string | number | undefined> {
  return {
    search: filters.search,
    category: filters.category,
    size: filters.size,
    color: filters.color,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    availability: filters.availability,
    sort: filters.sort,
    page: filters.page ?? 1,
    limit: filters.limit ?? 12,
  };
}
