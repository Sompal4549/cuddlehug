"use client";

import * as React from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Order } from "@/lib/types";
import { formatDateTime, formatMoney, ORDER_STATUS_LABELS, orderStatusTone } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty";

const STATUS_OPTIONS = [
  { value: "", label: "All orders" },
  ...Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

export default function OrdersPage() {
  const [orders, setOrders] = React.useState<Order[] | null>(null);
  const [status, setStatus] = React.useState("");

  React.useEffect(() => {
    api
      .get<{ items: Order[] }>("/orders", { query: { limit: 50 } })
      .then((data) => {
        const items = status ? data.items.filter((order) => order.status === status) : data.items;
        setOrders(items);
      })
      .catch(() => setOrders([]));
  }, [status]);

  if (orders === null) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Your orders</h2>
        <div className="w-44">
          <Select aria-label="Filter orders" value={status} onChange={(event) => setStatus(event.target.value)} options={STATUS_OPTIONS} />
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icon="orders"
            title={status ? "No orders with that status" : "No orders yet"}
            description="When you place an order it will show up here with live tracking."
            action={
              <Link href="/shop">
                <Button>Start shopping</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/account/orders/${order.id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 transition hover:border-primary"
              >
                <div>
                  <p className="text-sm font-semibold">{order.orderNumber}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDateTime(order.createdAt)} · {order.items.length} item(s)
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {order.items.slice(0, 3).map((item) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={item.id}
                        src={item.imageUrl ?? "/images/08_product_brown_teddy.jpg"}
                        alt=""
                        className="h-10 w-10 rounded object-cover"
                      />
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant={orderStatusTone(order.status)}>{ORDER_STATUS_LABELS[order.status]}</Badge>
                  <p className="mt-2 text-base font-bold">{formatMoney(order.totalAmount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.paymentStatus === "PAID" ? "Paid" : order.paymentMethod === "COD" ? "Pay on delivery" : "Payment pending"}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
