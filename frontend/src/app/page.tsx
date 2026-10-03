import Link from "next/link";
import { BadgeIndianRupee, Truck, RotateCcw, Sparkles } from "lucide-react";
import { getHomeContent } from "@/lib/server-api";
import { ProductCard } from "@/components/product-card";
import { ProductTabs } from "@/components/home/product-tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const revalidate = 30;

const perks = [
  { icon: Truck, title: "Free shipping", text: "On orders over ₹1,499" },
  { icon: BadgeIndianRupee, title: "Cash on delivery", text: "Available across India" },
  { icon: RotateCcw, title: "7-day returns", text: "Easy, no-drama exchanges" },
  { icon: Sparkles, title: "Handmade plush", text: "Stitched in small batches" },
];

export default async function HomePage() {
  const content = await getHomeContent();

  if (!content) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-32 text-center">
        <h1 className="text-2xl font-bold">The cuddle factory is warming up</h1>
        <p className="text-muted-foreground">We could not reach the store right now. Please refresh in a moment.</p>
        <Link href="/shop">
          <Button>Browse the shop</Button>
        </Link>
      </div>
    );
  }

  const hero = content.hero[0];
  const closing = content.hero[1] ?? hero;

  return (
    <div className="animate-fade-up">
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <div className="relative overflow-hidden rounded-xl border border-border bg-cream">
          <div className="grid lg:grid-cols-2">
            <div className="relative z-10 flex flex-col justify-center gap-5 p-8 sm:p-12 lg:p-16">
              <Badge variant="primary" className="w-fit">
                New season · softer than ever
              </Badge>
              <h1 className="text-balance text-4xl font-bold leading-[1.05] sm:text-5xl lg:text-6xl">
                More Happiness.
                <br />
                <span className="text-primary">More Hugs.</span>
              </h1>
              <p className="max-w-md text-base text-muted-foreground sm:text-lg">
                Cloud-soft teddy bears made for bedtime stories, sofa naps and the people you never want to let go of.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/shop">
                  <Button size="lg">Shop all teddies</Button>
                </Link>
                <Link href="/shop?category=giant">
                  <Button size="lg" variant="outline">
                    Meet the giants
                  </Button>
                </Link>
              </div>
              <p className="text-sm text-muted-foreground">
                Free shipping over <span className="font-semibold text-foreground">₹1,499</span> · COD available
              </p>
            </div>
            <div className="relative min-h-[280px] lg:min-h-[520px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={hero.image}
                alt={hero.alt}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Perks */}
      <section className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-4 py-8 sm:gap-4 lg:grid-cols-4 sm:px-6">
        {perks.map((perk) => (
          <div key={perk.title} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
            <perk.icon className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold">{perk.title}</p>
              <p className="text-xs text-muted-foreground">{perk.text}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold">Find your hug</h2>
            <p className="text-sm text-muted-foreground">Six families of bears, one obsession.</p>
          </div>
          <Link href="/shop" className="text-sm font-semibold text-primary hover:underline">
            View all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {content.categories.map((category) => (
            <Link
              key={category.id}
              href={`/shop?category=${category.slug}`}
              className="group relative overflow-hidden rounded-lg border border-border bg-muted"
            >
              <div className="aspect-[4/5]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={category.image ?? "/images/02_category_classic.jpg"}
                  alt={category.name}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/85 to-transparent p-3">
                <p className="text-sm font-semibold text-white">{category.name}</p>
                <p className="text-xs text-white/80">{category.productCount} teddies</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured / best sellers / new arrivals */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Bears everyone is hugging</h2>
          <p className="text-sm text-muted-foreground">Curated picks from the CuddleHug shelf.</p>
        </div>
        <ProductTabs featured={content.featured} bestSellers={content.bestSellers} newArrivals={content.newArrivals} />
      </section>

      {/* Promo band */}
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-2">
          <div className="relative min-h-[240px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={closing.image} alt={closing.alt} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          </div>
          <div className="flex flex-col justify-center gap-4 p-8 sm:p-12">
            <Badge variant="secondary" className="w-fit">
              Gifting sorted
            </Badge>
            <h2 className="text-3xl font-bold leading-tight">A bear that outlasts the bouquet</h2>
            <p className="text-muted-foreground">
              Birthdays, anniversaries, just-because days. Pick a size, add a note, and we will pack it in a gift box
              with a handwritten card.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/shop?sort=bestselling">
                <Button>Shop best sellers</Button>
              </Link>
              <Link href="/shop?search=gift">
                <Button variant="outline">Gift picks</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Best sellers preview */}
      <section className="mx-auto max-w-7xl px-4 pb-4 pt-8 sm:px-6">
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold">Ready to ship today</h2>
            <p className="text-sm text-muted-foreground">In stock and packed within 24 hours.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-6">
          {content.bestSellers.slice(0, 4).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>
    </div>
  );
}
