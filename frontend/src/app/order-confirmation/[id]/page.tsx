"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, Package, MapPin, Truck } from "lucide-react";
import { api } from "@/lib/api";
import type { Order } from "@/lib/types";
import { formatDateTime, formatMoney, ORDER_STATUS_LABELS, orderStatusTone } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty";

export default function OrderConfirmationPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = React.useState<Order | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api
      .get<Order>(`/orders/${params.id}`)
      .then(setOrder)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Order not found"));
  }, [params.id]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="rounded-lg border border-border bg-card">
          <EmptyState icon="orders" title="Order not found" description={error} action={<Link href="/shop"><Button>Back to shop</Button></Link>} />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const address = order.shippingAddress as { fullName?: string; line1?: string; city?: string; state?: string; pincode?: string; phone?: string };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="rounded-xl border border-border bg-card p-6 text-center shadow-soft sm:p-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/12">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </div>
        <h1 className="mt-4 text-2xl font-bold">
          {order.paymentMethod === "COD" ? "Order confirmed!" : "Payment successful!"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Order <span className="font-semibold text-foreground">{order.orderNumber}</span> is on its way to a hug. We
          have emailed you a receipt.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Badge variant={orderStatusTone(order.status)}>{ORDER_STATUS_LABELS[order.status]}</Badge>
          <Badge variant="default">Paid via {order.paymentMethod === "COD" ? "Cash on delivery" : "Razorpay"}</Badge>
        </div>
        {order.estimatedDelivery && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-md bg-cream px-3 py-2 text-sm">
            <Truck className="h-4 w-4 text-primary" />
            Estimated delivery by {formatDateTime(order.estimatedDelivery)}
          </p>
        )}
      </div>

      <section className="mt-6 rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
          <Package className="h-4 w-4 text-primary" /> Items
        </h2>
        <ul className="divide-y divide-border">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl ?? "/images/08_product_brown_teddy.jpg"} alt="" className="h-14 w-14 rounded-md object-cover" />
              <div className="flex-1 text-sm">
                <Link href={`/products/${item.productSlug}`} className="font-medium hover:text-primary">
                  {item.productName}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {item.variantLabel} · qty {item.quantity}
                </p>
              </div>
              <p className="text-sm font-semibold">{formatMoney(item.lineTotal)}</p>
            </li>
          ))}
        </ul>
        <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd>{formatMoney(order.subtotal)}</dd>
          </div>
          {Number(order.discountAmount) > 0 && (
            <div className="flex justify-between text-success">
              <dt>Discount {order.couponCode ? `(${order.couponCode})` : ""}</dt>
              <dd>-{formatMoney(order.discountAmount)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Shipping</dt>
            <dd>{Number(order.shippingAmount) === 0 ? "FREE" : formatMoney(order.shippingAmount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Tax</dt>
            <dd>{formatMoney(order.taxAmount)}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
            <dt>Total</dt>
            <dd>{formatMoney(order.totalAmount)}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-lg border border-border bg-card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
          <MapPin className="h-4 w-4 text-primary" /> Delivering to
        </h2>
        <p className="text-sm">
          <span className="font-semibold">{address.fullName}</span>
          <br />
          <span className="text-muted-foreground">
            {address.line1}, {address.city}, {address.state} {address.pincode}
          </span>
          <br />
          <span className="text-muted-foreground">{address.phone}</span>
        </p>
      </section>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/account/orders">
          <Button variant="outline">Track this order</Button>
        </Link>
        <Link href="/shop">
          <Button>Keep shopping</Button>
        </Link>
      </div>
    </div>
  );
}
