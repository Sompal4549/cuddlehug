"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Package, MapPin, CreditCard, Clock } from "lucide-react";
import { api } from "@/lib/api";
import type { Order } from "@/lib/types";
import { formatDateTime, formatMoney, ORDER_STATUS_LABELS, orderStatusTone } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty";

export default function OrderDetailPage() {
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
      <div className="rounded-lg border border-border bg-card">
        <EmptyState icon="orders" title="Order unavailable" description={error} />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const address = order.shippingAddress as {
    fullName?: string;
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    pincode?: string;
    phone?: string;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/account/orders" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> All orders
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant={orderStatusTone(order.status)}>{ORDER_STATUS_LABELS[order.status]}</Badge>
          <Badge variant={order.paymentStatus === "PAID" ? "success" : "default"}>
            {order.paymentStatus === "PAID" ? "Paid" : order.paymentMethod === "COD" ? "COD" : "Awaiting payment"}
          </Badge>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-lg font-bold">{order.orderNumber}</p>
            <p className="text-sm text-muted-foreground">Placed on {formatDateTime(order.createdAt)}</p>
          </div>
          {order.estimatedDelivery && (
            <p className="text-sm">
              <span className="text-muted-foreground">Estimated delivery:</span>{" "}
              <span className="font-semibold">{formatDateTime(order.estimatedDelivery)}</span>
            </p>
          )}
        </div>

        {(order.trackingNumber || order.courierName) && (
          <div className="mt-4 rounded-md bg-cream p-3 text-sm">
            <span className="font-semibold">{order.courierName ?? "Courier"}</span>{" "}
            <span className="text-muted-foreground">· Tracking {order.trackingNumber}</span>
          </div>
        )}

        <ul className="mt-4 divide-y divide-border">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl ?? "/images/08_product_brown_teddy.jpg"} alt="" className="h-14 w-14 rounded-md object-cover" />
              <div className="flex-1 text-sm">
                <Link href={`/products/${item.productSlug}`} className="font-medium hover:text-primary">
                  {item.productName}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {item.variantLabel} · {formatMoney(item.unitPrice)} × {item.quantity}
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
              <dt>Discount</dt>
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
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <MapPin className="h-4 w-4 text-primary" /> Shipping address
          </h3>
          <p className="text-sm">
            <span className="font-semibold">{address.fullName}</span>
            <br />
            <span className="text-muted-foreground">
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ""}, {address.city}, {address.state} {address.pincode}
            </span>
            <br />
            <span className="text-muted-foreground">{address.phone}</span>
          </p>
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <CreditCard className="h-4 w-4" />
            {order.paymentMethod === "COD" ? "Cash on delivery" : "Razorpay"}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
            <Clock className="h-4 w-4 text-primary" /> Timeline
          </h3>
          <ol className="space-y-3">
            {(order.history ?? []).slice().reverse().map((entry) => (
              <li key={entry.id} className="flex gap-3 text-sm">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                <div>
                  <p className="font-medium">{ORDER_STATUS_LABELS[entry.status] ?? entry.status}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(entry.createdAt)}
                    {entry.note ? ` · ${entry.note}` : ""}
                  </p>
                </div>
              </li>
            ))}
            {(order.history ?? []).length === 0 && <Package className="h-4 w-4 text-muted-foreground" />}
          </ol>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/shop">
          <Button variant="outline">Buy it again</Button>
        </Link>
        <Link href="/contact">
          <Button variant="ghost">Need help?</Button>
        </Link>
      </div>
    </div>
  );
}
