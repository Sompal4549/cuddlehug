import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, getProductList, getProductReviews, getRelated } from "@/lib/server-api";
import { absoluteUrl } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { ProductView } from "@/components/product/product-view";
import { ProductCard } from "@/components/product-card";

export const revalidate = 60;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Product not found" };
  const image = product.images[0]?.url;
  return {
    title: product.name,
    description: product.shortDescription ?? product.description.slice(0, 155),
    openGraph: {
      title: product.name,
      description: product.shortDescription ?? undefined,
      images: image ? [{ url: absoluteUrl(image), width: 800, height: 800 }] : undefined,
      type: "website",
    },
  };
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const [reviews, related, alsoLiked] = await Promise.all([
    getProductReviews(product.id),
    getRelated(slug),
    getProductList("sort=bestselling&limit=4"),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    description: product.shortDescription ?? product.description,
    image: product.images.map((image) => absoluteUrl(image.url)),
    brand: { "@type": "Brand", name: "CuddleHug" },
    aggregateRating:
      product.ratingCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: product.ratingAverage,
            reviewCount: product.ratingCount,
          }
        : undefined,
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: product.price,
      availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url: absoluteUrl(`/products/${product.slug}`),
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <nav className="mb-5 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-primary">
          Home
        </Link>
        <span>/</span>
        <Link href="/shop" className="hover:text-primary">
          Shop
        </Link>
        <span>/</span>
        <Link href={`/shop?category=${product.category.slug}`} className="hover:text-primary">
          {product.category.name}
        </Link>
        <span>/</span>
        <span className="text-foreground">{product.name}</span>
      </nav>

      <ProductView product={product} reviews={reviews?.items ?? []} ratingCount={product.ratingCount} />

      {related?.items?.length ? (
        <section className="mt-14">
          <h2 className="mb-4 text-xl font-bold">You may also like</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.items.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      ) : null}

      {alsoLiked?.items?.length ? (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-bold">Best sellers right now</h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {alsoLiked.items.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      ) : null}

      <p className="mt-10 text-center text-sm text-muted-foreground">
        Free shipping over ₹1,499 · Cash on delivery available · {formatMoney(product.price)} inclusive of taxes
      </p>
    </div>
  );
}
