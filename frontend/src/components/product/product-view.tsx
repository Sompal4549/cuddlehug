"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, ShieldCheck, Truck, PackageCheck, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { useSession } from "@/lib/session";
import { discountLabel, formatMoney, pluralize } from "@/lib/format";
import type { ProductDetail as ProductDetailType, Review } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Stars } from "@/components/ui/stars";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const trust = [
  { icon: Truck, text: "Free shipping over ₹1,499" },
  { icon: PackageCheck, text: "Packed within 24 hours" },
  { icon: RotateCcw, text: "7-day easy returns" },
  { icon: ShieldCheck, text: "Skin-safe, non-toxic plush" },
];

export function ProductView({
  product,
  reviews,
  ratingCount,
}: {
  product: ProductDetailType;
  reviews: Review[];
  ratingCount: number;
}) {
  const router = useRouter();
  const { addItem } = useCart();
  const { user } = useSession();

  const firstAvailable = product.variants.find((variant) => variant.available > 0) ?? product.variants[0];
  const [color, setColor] = React.useState(firstAvailable.color);
  const [size, setSize] = React.useState(firstAvailable.size);
  const [quantity, setQuantity] = React.useState(1);
  const [adding, setAdding] = React.useState(false);
  const [activeImage, setActiveImage] = React.useState(0);
  const [reviewOpen, setReviewOpen] = React.useState(false);

  const colors = Array.from(new Set(product.variants.map((variant) => variant.color)));
  const sizes = Array.from(new Set(product.variants.map((variant) => variant.size)));
  const variant =
    product.variants.find((item) => item.color === color && item.size === size) ??
    product.variants.find((item) => item.color === color) ??
    firstAvailable;
  const maxQuantity = Math.max(1, Math.min(10, variant?.available ?? 1));
  const image = product.images[activeImage]?.url ?? "/images/08_product_brown_teddy.jpg";
  const label = discountLabel(product.mrp, product.price);

  const add = async () => {
    if (!variant || variant.available < 1) {
      toast.error("That combination is out of stock");
      return;
    }
    setAdding(true);
    try {
      await addItem(variant.id, quantity);
      toast.success(`${product.name} added to your bag`, {
        action: { label: "View bag", onClick: () => router.push("/cart") },
      });
    } catch {
      toast.error("Could not add to bag");
    } finally {
      setAdding(false);
    }
  };

  const buyNow = async () => {
    await add();
    router.push("/checkout");
  };

  const toggleWishlist = async () => {
    if (!user) {
      toast.info("Sign in to save favourites");
      router.push(`/login?next=/products/${product.slug}`);
      return;
    }
    try {
      await api.post("/wishlist", { productId: product.id });
      toast.success("Saved to wishlist");
    } catch {
      toast.error("Could not update wishlist");
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Gallery */}
      <div className="flex flex-col gap-3">
        <div className="overflow-hidden rounded-lg border border-border bg-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt={product.images[activeImage]?.alt ?? product.name} className="aspect-square w-full object-cover" />
        </div>
        {product.images.length > 1 && (
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
            {product.images.map((entry, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setActiveImage(index)}
                className={cn(
                  "h-20 w-20 shrink-0 overflow-hidden rounded-md border-2 transition",
                  index === activeImage ? "border-primary" : "border-border hover:border-muted-foreground",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={entry.url} alt={entry.alt} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Buy box */}
      <div className="flex flex-col gap-5">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/shop?category=${product.category.slug}`} className="text-xs font-semibold uppercase tracking-wide text-primary">
              {product.category.name}
            </Link>
            {product.isBestSeller && <Badge variant="primary">Best seller</Badge>}
            {product.isNewArrival && <Badge variant="info">New</Badge>}
            {label && <Badge variant="destructive">{label}</Badge>}
          </div>
          <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">{product.name}</h1>
          <button
            type="button"
            onClick={() => document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth" })}
            className="mt-2 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <Stars rating={product.ratingAverage} />
            <span>
              {product.ratingAverage.toFixed(1)} · {pluralize(ratingCount, "review")}
            </span>
          </button>
        </div>

        <div className="flex items-end gap-3 rounded-lg border border-border bg-cream p-4">
          <span className="text-3xl font-bold">{formatMoney(variant?.price ?? product.price)}</span>
          <span className="pb-1 text-sm text-muted-foreground line-through">{formatMoney(variant?.mrp ?? product.mrp)}</span>
          <span className="pb-1 text-sm font-semibold text-success">
            Save {formatMoney(Number((variant?.mrp ?? product.mrp)) - Number(variant?.price ?? product.price))}
          </span>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">{product.shortDescription ?? product.description}</p>

        {/* Colour */}
        <div>
          <p className="mb-2 text-sm font-semibold">
            Colour: <span className="font-normal text-muted-foreground">{color}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {colors.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setColor(option)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-semibold uppercase transition",
                  color === option ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        {/* Size */}
        <div>
          <p className="mb-2 text-sm font-semibold">
            Size: <span className="font-normal text-muted-foreground">{size}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((option) => {
              const match = product.variants.find((item) => item.size === option && item.color === color);
              const disabled = !match || match.available < 1;
              return (
                <button
                  key={option}
                  type="button"
                  disabled={disabled}
                  onClick={() => setSize(option)}
                  className={cn(
                    "rounded-md border px-3.5 py-2 text-xs font-semibold uppercase transition",
                    size === option ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary",
                    disabled && "cursor-not-allowed opacity-40 line-through",
                  )}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <QuantityStepper value={quantity} max={maxQuantity} onChange={setQuantity} disabled={adding} />
          <Button size="lg" className="flex-1 min-w-40" onClick={add} loading={adding} disabled={!variant || variant.available < 1}>
            {variant && variant.available < 1 ? "Out of stock" : "Add to bag"}
          </Button>
          <Button size="lg" variant="secondary" onClick={buyNow} disabled={!variant || variant.available < 1}>
            Buy now
          </Button>
          <Button size="icon" variant="outline" aria-label="Add to wishlist" onClick={toggleWishlist} className="h-12 w-12">
            <Heart className="h-5 w-5" />
          </Button>
        </div>

        {variant && variant.available > 0 && variant.available <= 5 && (
          <p className="text-sm font-medium text-warning">Hurry — only {variant.available} left in this size.</p>
        )}

        <div className="grid gap-2 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
          {trust.map((item) => (
            <div key={item.text} className="flex items-center gap-2 text-sm text-muted-foreground">
              <item.icon className="h-4 w-4 text-primary" />
              {item.text}
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-border bg-card">
          <details className="group border-b border-border p-4" open>
            <summary className="cursor-pointer text-sm font-semibold">Description</summary>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{product.description}</p>
          </details>
          <details className="group border-b border-border p-4">
            <summary className="cursor-pointer text-sm font-semibold">Details &amp; care</summary>
            <dl className="mt-2 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              {product.material && (
                <div>
                  <dt className="font-medium text-foreground">Material</dt>
                  <dd>{product.material}</dd>
                </div>
              )}
              {product.filling && (
                <div>
                  <dt className="font-medium text-foreground">Filling</dt>
                  <dd>{product.filling}</dd>
                </div>
              )}
              {product.weightGrams && (
                <div>
                  <dt className="font-medium text-foreground">Weight</dt>
                  <dd>{product.weightGrams} g</dd>
                </div>
              )}
              {product.ageRecommendation && (
                <div>
                  <dt className="font-medium text-foreground">Age</dt>
                  <dd>{product.ageRecommendation}</dd>
                </div>
              )}
              {product.careInstructions && (
                <div className="sm:col-span-2">
                  <dt className="font-medium text-foreground">Care</dt>
                  <dd>{product.careInstructions}</dd>
                </div>
              )}
            </dl>
          </details>
          <div className="p-4">
            <p className="text-sm font-semibold">SKU</p>
            <p className="mt-1 text-sm text-muted-foreground">{variant?.sku ?? product.sku}</p>
          </div>
        </div>
      </div>

      <ReviewSection
        reviews={reviews}
        ratingAverage={product.ratingAverage}
        ratingCount={ratingCount}
        canWrite={Boolean(user)}
        onWrite={() => setReviewOpen(true)}
      />

      <ReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        productId={product.id}
        productName={product.name}
        onSubmitted={() => setReviewOpen(false)}
      />
    </div>
  );
}

function ReviewSection({
  reviews,
  ratingAverage,
  ratingCount,
  canWrite,
  onWrite,
}: {
  reviews: Review[];
  ratingAverage: number;
  ratingCount: number;
  canWrite: boolean;
  onWrite: () => void;
}) {
  return (
    <section id="reviews" className="scroll-mt-24 lg:col-span-2">
      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Ratings &amp; reviews</h2>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <Stars rating={ratingAverage} size={16} />
              <span className="font-semibold text-foreground">{ratingAverage.toFixed(1)}</span>
              <span>· {pluralize(ratingCount, "review")}</span>
            </div>
          </div>
          <Button variant="outline" onClick={onWrite} disabled={!canWrite}>
            Write a review
          </Button>
        </div>

        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            {reviews.length === 0 && (
              <p className="text-sm text-muted-foreground">No reviews yet — be the first to share the hug.</p>
            )}
            {reviews.map((review) => (
              <article key={review.id} className="rounded-md border border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {review.user?.name ?? "Verified buyer"}
                  </p>
                  <Stars rating={review.rating} size={12} />
                </div>
                <p className="mt-1 text-sm font-medium">{review.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{review.comment}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(review.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              </article>
            ))}
          </div>
          <div className="flex flex-col justify-center gap-4 rounded-md bg-cream p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Every review comes from a verified purchase, so you know the bear really was hugged.
            </p>
            <Button variant="outline" onClick={onWrite} disabled={!canWrite}>
              Share your thoughts
            </Button>
            {!canWrite && <p className="text-xs text-muted-foreground">Sign in to write a review.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

function ReviewDialog({
  open,
  onOpenChange,
  productId,
  productName,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  onSubmitted: () => void;
}) {
  const [rating, setRating] = React.useState(5);
  const [title, setTitle] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.post("/reviews", { productId, rating, title: title.trim(), comment: comment.trim() });
      toast.success("Thanks! Your review is awaiting moderation.");
      setTitle("");
      setComment("");
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit review");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader title={`Review ${productName}`} description="Only purchases can be reviewed." />
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium">Your rating</p>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  aria-label={`${value} stars`}
                  className="rounded p-1"
                >
                  <Stars rating={value <= rating ? 1 : 0} size={24} />
                </button>
              ))}
            </div>
          </div>
          <Field label="Title" required>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Sooo soft!" maxLength={80} />
          </Field>
          <Field label="Your review" required>
            <Textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Tell other huggers what you loved..."
              rows={4}
              maxLength={600}
            />
          </Field>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} loading={busy} disabled={!title.trim() || comment.trim().length < 10}>
            Submit review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
