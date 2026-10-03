import { describe, expect, it } from "vitest";
import { api } from "./helpers";

describe("catalogue API", () => {
  it("reports health", async () => {
    const res = await api().get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("ok");
  });

  it("lists active products with pagination metadata", async () => {
    const res = await api().get("/api/products?limit=4&page=1");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items.length).toBe(4);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 4 });
    expect(res.body.meta.total).toBeGreaterThanOrEqual(14);
    const first = res.body.data.items[0];
    expect(first).toHaveProperty("slug");
    expect(first).toHaveProperty("price");
    expect(first.status ?? "ACTIVE").toBe("ACTIVE");
  });

  it("rejects an out-of-range page size", async () => {
    const res = await api().get("/api/products?limit=0");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("filters by category slug", async () => {
    const categories = await api().get("/api/categories");
    const slug = categories.body.data.items[0].slug;
    const res = await api().get(`/api/products?category=${slug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
    for (const item of res.body.data.items) {
      expect(item.category.slug).toBe(slug);
    }
  });

  it("searches products", async () => {
    const res = await api().get("/api/products?search=teddy");
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });

  it("returns an empty page for a query that matches nothing", async () => {
    const res = await api().get("/api/products?search=zzz-no-such-product-zzz");
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
  });

  it("serves a product detail page by slug with variants", async () => {
    const list = await api().get("/api/products?limit=1");
    const slug = list.body.data.items[0].slug;
    const res = await api().get(`/api/products/${slug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.variants.length).toBeGreaterThan(0);
    expect(res.body.data.variants[0]).toHaveProperty("price");
    expect(res.body.data.variants[0]).toHaveProperty("available");
    expect(res.body.data.images.length).toBeGreaterThan(0);
  });

  it("404s on an unknown slug", async () => {
    const res = await api().get("/api/products/definitely-not-a-real-product");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("lists categories with product counts and children", async () => {
    const res = await api().get("/api/categories");
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(6);
    for (const item of res.body.data.items) {
      expect(item).toHaveProperty("productCount");
      expect(item).toHaveProperty("childCount");
    }
  });

  it("returns published reviews for a product", async () => {
    const list = await api().get("/api/products?limit=1");
    const detail = await api().get(`/api/products/${list.body.data.items[0].slug}`);
    const res = await api().get(`/api/reviews/product/${detail.body.data.id}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  it("exposes homepage content", async () => {
    const res = await api().get("/api/content/home");
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("featured");
    expect(res.body.data).toHaveProperty("categories");
  });
});
