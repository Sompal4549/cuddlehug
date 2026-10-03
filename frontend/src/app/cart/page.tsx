"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Tag, ShoppingBag, ShieldCheck, Truck } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import { useSession } from "@/lib/session";
import { formatMoney, discountLabel } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { QuantityStepper } from "@/components/ui/quantity-stepper";
import { EmptyState } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";

export default function CartPage() {
  const router = useRouter();
  const { cart, loading, updateItem, removeItem, applyCoupon, removeCoupon, error } = useCart();
  const { user } = useSession();
  const [code, setCode] = React.useState(cart.coupon?.code ?? "");
  const [busy, setBusy] = React.useState(false);

  const apply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    try {
      await applyCoupon(code.trim());
      toast.success("Coupon applied");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Coupon could not be applied");
    } finally {
      setBusy(false);
    }
  };

  const clearCoupon = async () => {
    await removeCoupon();
    setCode("");
    toast.success("Coupon removed");
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-28 w-full" />
            ))}
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icon="cart"
            title="Your bag is feeling light"
            description="Pick a bear (or three) and they will show up right here."
            action={
              <Link href="/shop">
                <Button>Start shopping</Button>
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your bag</h1>
        <Link href="/shop" className="text-sm font-semibold text-primary hover:underline">
          Continue shopping
        </Link>
      </div>

      {error && <p className="mb-4 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-3">
          {cart.items.map((item) => (
            <article key={item.id} className="flex gap-4 rounded-lg border border-border bg-card p-4">
              <Link href={`/products/${item.productSlug}`} className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.imageUrl ?? "/images/08_product_brown_teddy.jpg"}
                  alt={item.productName}
                  className="h-24 w-24 rounded-md object-cover"
                />
              </Link>
              <div className="flex flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/products/${item.productSlug}`} className="text-sm font-semibold hover:text-primary">
                      {item.productName}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.variantLabel}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatMoney(item.unitPrice)} each
                      {Number(item.mrp) > Number(item.unitPrice) && (
                        <span className="ml-1 text-success">· {discountLabel(item.mrp, item.unitPrice)}</span>
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${item.productName}`}
                    onClick={() => void removeItem(item.id)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-auto flex items-center justify-between gap-3">
                  <QuantityStepper
                    value={item.quantity}
                    max={item.maxQuantity}
                    onChange={(value) => void updateItem(item.variantId, value)}
                  />
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatMoney(item.lineTotal)}</p>
                    {Number(item.savings) > 0 && (
                      <p className="text-xs text-success">You save {formatMoney(item.savings)}</p>
                    )}
                  </div>
                </div>
                {!item.inStock && <p className="text-xs font-medium text-destructive">Out of stock</p>}
              </div>
            </article>
          ))}
        </div>

        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-base font-bold">Order summary</h2>

            <form onSubmit={apply} className="mt-4">
              <Field label="Coupon code">
                <div className="flex gap-2">
                  <Input
                    value={code}
                    onChange={(event) => setCode(event.target.value.toUpperCase())}
                    placeholder="CUDDLE10"
                    disabled={Boolean(cart.coupon)}
                  />
                  <Button type="submit" variant="outline" loading={busy} disabled={Boolean(cart.coupon)}>
                    <Tag className="h-4 w-4" />
                  </Button>
                </div>
              </Field>
              {cart.coupon && (
                <button
                  type="button"
                  onClick={() => void clearCoupon()}
                  className="mt-2 text-xs font-medium text-destructive hover:underline"
                >
                  Remove {cart.coupon.code}
                </button>
              )}
            </form>

            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-medium">{formatMoney(cart.summary.subtotal)}</dd>
              </div>
              {Number(cart.summary.productSavings) > 0 && (
                <div className="flex justify-between text-success">
                  <dt>Product savings</dt>
                  <dd>-{formatMoney(cart.summary.productSavings)}</dd>
                </div>
              )}
              {Number(cart.summary.couponDiscount) > 0 && (
                <div className="flex justify-between text-success">
                  <dt>Coupon ({cart.coupon?.code})</dt>
                  <dd>-{formatMoney(cart.summary.couponDiscount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd className="font-medium">
                  {Number(cart.summary.shipping) === 0 ? "FREE" : formatMoney(cart.summary.shipping)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tax (GST)</dt>
                <dd className="font-medium">{formatMoney(cart.summary.tax)}</dd>
              </div>
              <div className="mt-2 flex justify-between border-t border-border pt-3 text-base font-bold">
                <dt>Total</dt>
                <dd>{formatMoney(cart.summary.total)}</dd>
              </div>
            </dl>

            {!cart.summary.freeShippingUnlocked && (
              <div className="mt-4 rounded-md bg-cream p-3 text-xs text-muted-foreground">
                <Truck className="mb-1 h-4 w-4 text-primary" />
                Add {formatMoney(Math.max(0, 1499 - Number(cart.summary.discountedSubtotal)))} more
                for free shipping.
              </div>
            )}

            <Button
              size="lg"
              className="mt-4 w-full"
              onClick={() => router.push(user ? "/checkout" : "/login?next=/checkout")}
            >
              <ShoppingBag className="h-4 w-4" />
              {user ? "Proceed to checkout" : "Sign in to checkout"}
            </Button>

            <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-success" /> Secure checkout · UPI, cards &amp; COD
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
