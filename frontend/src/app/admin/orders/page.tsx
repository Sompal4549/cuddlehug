"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Truck } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type { Order, OrderStatus } from "@/lib/types";
import { formatDateTime, formatMoney, ORDER_STATUS_LABELS, ORDER_STATUS_FLOW, orderStatusTone } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty";
import { Pagination } from "@/components/ui/pagination";
import { Panel } from "@/components/admin/panels";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  ...Object.keys(ORDER_STATUS_LABELS).map((value) => ({ value, label: ORDER_STATUS_LABELS[value] })),
];

const PAYMENT_OPTIONS = [
  { value: "", label: "Any payment" },
  { value: "PENDING", label: "Payment pending" },
  { value: "PAID", label: "Paid" },
  { value: "FAILED", label: "Failed" },
  { value: "REFUNDED", label: "Refunded" },
];

export default function AdminOrdersPage() {
  const [orders, setOrders] = React.useState<Order[] | null>(null);
  const [meta, setMeta] = React.useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [payment, setPayment] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setOrders(null);
    api
      .getFull<{ items: Order[] }>("/admin/orders", {
        query: { page, limit: 12, search: query || undefined, status: status || undefined, paymentStatus: payment || undefined },
      })
      .then(({ data, meta: pageMeta }) => {
        if (!active) return;
        setOrders(data.items);
        setMeta({
          page: Number(pageMeta?.page ?? 1),
          totalPages: Number(pageMeta?.totalPages ?? 1),
          total: Number(pageMeta?.total ?? 0),
        });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setOrders([]);
        toast.error(errorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [page, query, status, payment]);

  const quickAdvance = async (order: Order) => {
    const next = ORDER_STATUS_FLOW[order.status]?.[0];
    if (!next) return;
    setBusyId(order.id);
    try {
      await api.patch(`/admin/orders/${order.id}/status`, { status: next });
      setOrders((prev) => (prev ?? []).map((row) => (row.id === order.id ? { ...row, status: next as OrderStatus } : row)));
      toast.success(`Order moved to ${ORDER_STATUS_LABELS[next]}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Orders</h1>
          <p className="text-sm text-muted-foreground">{meta.total} orders total</p>
        </div>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setQuery(search.trim());
          }}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Order # or customer"
              className="w-56 pl-9"
            />
          </div>
          <Select
            className="w-44"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
          />
          <Select
            className="w-44"
            options={PAYMENT_OPTIONS}
            value={payment}
            onChange={(event) => {
              setPage(1);
              setPayment(event.target.value);
            }}
          />
          <Button type="submit" variant="outline">
            Filter
          </Button>
        </form>
      </div>

      <Panel title="All orders">
        {orders === null ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState icon="orders" title="No orders match" description="Try clearing the filters." />
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 pb-2">Order</th>
                  <th className="px-5 pb-2">Customer</th>
                  <th className="px-5 pb-2">Items</th>
                  <th className="px-5 pb-2">Total</th>
                  <th className="px-5 pb-2">Payment</th>
                  <th className="px-5 pb-2">Status</th>
                  <th className="px-5 pb-2">Placed</th>
                  <th className="px-5 pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-5 py-3">
                      <Link href={`/admin/orders/${order.id}`} className="font-medium text-primary hover:underline">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {order.user ? `${order.user.firstName} ${order.user.lastName}` : "Guest"}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{order.items.length}</td>
                    <td className="px-5 py-3 font-semibold">{formatMoney(order.totalAmount)}</td>
                    <td className="px-5 py-3">
                      <Badge variant={order.paymentStatus === "PAID" ? "success" : order.paymentStatus === "REFUNDED" ? "info" : "warning"}>
                        {order.paymentMethod} · {order.paymentStatus}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={orderStatusTone(order.status)}>{ORDER_STATUS_LABELS[order.status]}</Badge>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDateTime(order.createdAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/admin/orders/${order.id}`}>
                          <Button variant="outline" size="sm">
                            Open
                          </Button>
                        </Link>
                        {ORDER_STATUS_FLOW[order.status]?.[0] && (
                          <Button size="sm" loading={busyId === order.id} onClick={() => void quickAdvance(order)}>
                            <Truck className="h-3.5 w-3.5" />
                            {ORDER_STATUS_LABELS[ORDER_STATUS_FLOW[order.status][0]]}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} />
    </div>
  );
}

