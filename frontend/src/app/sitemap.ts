import type { MetadataRoute } from "next";
import { getCategories, getProductList } from "@/lib/server-api";
import { absoluteUrl } from "@/lib/utils";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = ["", "/shop", "/about", "/contact", "/shipping", "/returns", "/faq", "/care", "/privacy", "/terms"].map(
    (path) => ({
      url: absoluteUrl(path),
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    }),
  );

  const [products, categories] = await Promise.all([
    getProductList("limit=48&sort=bestselling").catch(() => null),
    getCategories().catch(() => null),
  ]);

  const productRoutes = (products?.items ?? []).map((product) => ({
    url: absoluteUrl(`/products/${product.slug}`),
    lastModified: new Date(product.createdAt),
    changeFrequency: "daily" as const,
    priority: 0.8,
  }));

  const categoryRoutes = (categories ?? []).map((category) => ({
    url: absoluteUrl(`/shop?category=${category.slug}`),
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
