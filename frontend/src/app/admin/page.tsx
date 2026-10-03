"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Clock, IndianRupee, Package, ShoppingBag, Star, Users } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/lib/api";
import type { AdminDashboard } from "@/lib/types";
import { formatDate, formatMoney, ORDER_STATUS_LABELS, orderStatusTone } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel, StatCard } from "@/components/admin/panels";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#d99b28",
  CONFIRMED: "#2f9e6f",
  PROCESSING: "#e0674f",
  PACKED: "#6b4a35",
  SHIPPED: "#4a7fc1",
  OUT_FOR_DELIVERY: "#8e6bd6",
  DELIVERED: "#2f9e6f",
  CANCELLED: "#d64545",
  RETURNED: "#d64545",
  REFUNDED: "#9c9791",
};

export default function AdminDashboardPage() {
  const [data, setData] = React.useState<AdminDashboard | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api
      .get<AdminDashboard>("/admin/dashboard")
      .then(setData)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load dashboard"));
  }, []);

  if (error) {
    return <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>;
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const { cards } = data;
  const chart = data.chart.map((point) => ({ ...point, label: formatDate(point.date, { day: "numeric", month: "short" }) }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Live numbers from your store.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/orders">
            <Button variant="outline" size="sm">
              Manage orders
            </Button>
          </Link>
          <Link href="/admin/products/new">
            <Button size="sm">Add product</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Revenue" value={formatMoney(cards.revenue)} hint={`${cards.paidOrders} paid orders`} icon={<IndianRupee className="h-4 w-4" />} />
        <StatCard label="Orders" value={cards.totalOrders} hint={`${cards.pendingOrders} need attention`} icon={<ShoppingBag className="h-4 w-4" />} />
        <StatCard label="Customers" value={cards.totalCustomers} hint={`${cards.newCustomers} new`} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Products" value={cards.totalProducts} hint={`${cards.lowStock} low in stock`} icon={<Package className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Revenue (last 30 days)" className="lg:col-span-2">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#e0674f" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#e0674f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eadfd6" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#7b6a60" />
                <YAxis tick={{ fontSize: 11 }} stroke="#7b6a60" />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: "1px solid #eadfd6", fontSize: 12 }}
                  formatter={(value) => [formatMoney(Number(value)), "Revenue"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="#e0674f" strokeWidth={2} fill="url(#revenue)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Orders by status">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.statusBreakdown} dataKey="count" nameKey="status" innerRadius={52} outerRadius={82} paddingAngle={2}>
                  {data.statusBreakdown.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#e0674f"} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {data.statusBreakdown.map((entry) => (
              <Badge key={entry.status} variant={orderStatusTone(entry.status)}>
                {ORDER_STATUS_LABELS[entry.status]}: {entry.count}
              </Badge>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Recent orders" className="lg:col-span-2">
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 pb-2">Order</th>
                  <th className="px-5 pb-2">Customer</th>
                  <th className="px-5 pb-2">Total</th>
                  <th className="px-5 pb-2">Status</th>
                  <th className="px-5 pb-2">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.recentOrders.slice(0, 6).map((order) => (
                  <tr key={order.id}>
                    <td className="px-5 py-2.5">
                      <Link href={`/admin/orders/${order.id}`} className="font-medium text-primary hover:underline">
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-2.5 text-muted-foreground">{order.customer}</td>
                    <td className="px-5 py-2.5 font-semibold">{formatMoney(order.totalAmount)}</td>
                    <td className="px-5 py-2.5">
                      <Badge variant={orderStatusTone(order.status)}>{ORDER_STATUS_LABELS[order.status]}</Badge>
                    </td>
                    <td className="px-5 py-2.5 text-muted-foreground">{formatDate(order.createdAt)}</td>
                  </tr>
                ))}
                {data.recentOrders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-6 text-center text-muted-foreground">
                      No orders yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Low stock">
            {data.lowStock.length === 0 ? (
              <p className="text-sm text-muted-foreground">Every bear is well stocked.</p>
            ) : (
              <ul className="space-y-2">
                {data.lowStock.slice(0, 6).map((row) => (
                  <li key={row.variantId} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">
                      {row.product.name}
                      <span className="ml-1 text-xs text-muted-foreground">
                        {row.size} / {row.color}
                      </span>
                    </span>
                    <Badge variant={row.available === 0 ? "destructive" : "warning"}>{row.available}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Needs your attention">
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-warning" /> Pending orders
                </span>
                <Badge variant="warning">{cards.pendingOrders}</Badge>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" /> Low stock items
                </span>
                <Badge variant="destructive">{cards.lowStock}</Badge>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-primary" /> Reviews to moderate
                </span>
                <Badge variant="info">{cards.pendingReviews}</Badge>
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
