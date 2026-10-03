"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type { CouponReportRow, CustomerReportRow, OrdersReport, ProductReportRow, SalesReport } from "@/lib/types";
import { formatDateTime, formatMoney } from "@/lib/format";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Panel, StatCard } from "@/components/admin/panels";

const RANGES = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "1y", label: "Last year" },
  { value: "all", label: "All time" },
];

export default function AdminReportsPage() {
  const [range, setRange] = React.useState("30d");
  const [tab, setTab] = React.useState("sales");
  const [sales, setSales] = React.useState<SalesReport | null>(null);
  const [orders, setOrders] = React.useState<OrdersReport | null>(null);
  const [products, setProducts] = React.useState<ProductReportRow[] | null>(null);
  const [customers, setCustomers] = React.useState<CustomerReportRow[] | null>(null);
  const [coupons, setCoupons] = React.useState<CouponReportRow[] | null>(null);

  React.useEffect(() => {
    let active = true;
    const query = { range };
    setSales(null);
    setOrders(null);
    setProducts(null);
    setCustomers(null);
    setCoupons(null);

    api
      .get<SalesReport>("/admin/reports/sales", { query })
      .then((data) => active && setSales(data))
      .catch((error: unknown) => active && toast.error(errorMessage(error)));
    api
      .get<OrdersReport>("/admin/reports/orders", { query })
      .then((data) => active && setOrders(data))
      .catch(() => undefined);
    api
      .get<{ items: ProductReportRow[] }>("/admin/reports/products", { query: { ...query, limit: 48 } })
      .then((data) => active && setProducts(data.items))
      .catch(() => undefined);
    api
      .get<{ items: CustomerReportRow[] }>("/admin/reports/customers", { query })
      .then((data) => active && setCustomers(data.items))
      .catch(() => undefined);
    api
      .get<{ items: CouponReportRow[] }>("/admin/reports/coupons", { query })
      .then((data) => active && setCoupons(data.items))
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [range]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">Sales performance and store insights.</p>
        </div>
        <div className="w-48">
          <Select value={range} onChange={(event) => setRange(event.target.value)} options={RANGES} />
        </div>
      </div>

      <Tabs
        items={[
          { value: "sales", label: "Sales" },
          { value: "orders", label: "Orders" },
          { value: "products", label: "Products" },
          { value: "customers", label: "Customers" },
          { value: "coupons", label: "Coupons" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "sales" &&
        (sales === null ? (
          <Skeleton className="h-80 w-full" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Revenue" value={formatMoney(sales.totals.revenue)} />
              <StatCard label="Orders" value={sales.totals.orders} />
              <StatCard label="Avg order value" value={formatMoney(sales.totals.averageOrderValue)} />
              <StatCard label="Discounts given" value={formatMoney(sales.totals.discounts)} />
            </div>
            <Panel title="Daily revenue">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sales.series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eadfd6" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="#7b6a60" />
                    <YAxis tick={{ fontSize: 11 }} stroke="#7b6a60" />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "1px solid #eadfd6", fontSize: 12 }}
                      formatter={(value) => [formatMoney(Number(value)), "Revenue"]}
                    />
                    <Bar dataKey="revenue" fill="#e0674f" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Panel>
            <Panel title="Tax & shipping collected">
              <div className="grid gap-3 sm:grid-cols-3">
                <StatCard label="GST collected" value={formatMoney(sales.totals.tax)} />
                <StatCard label="Shipping collected" value={formatMoney(sales.totals.shipping)} />
                <StatCard label="Gross (before discounts)" value={formatMoney(sales.totals.revenue)} />
              </div>
            </Panel>
          </>
        ))}

      {tab === "orders" &&
        (orders === null ? (
          <Skeleton className="h-80 w-full" />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel title="By status">
              <ReportTable
                head={["Status", "Orders", "Value"]}
                rows={orders.byStatus.map((row) => [row.status.replaceAll("_", " "), String(row.count), formatMoney(row.amount)])}
              />
            </Panel>
            <Panel title="By payment status">
              <ReportTable
                head={["Status", "Orders", "Value"]}
                rows={orders.byPaymentStatus.map((row) => [row.status, String(row.count), formatMoney(row.amount)])}
              />
            </Panel>
            <Panel title="By payment method">
              <ReportTable
                head={["Method", "Orders", "Value"]}
                rows={orders.byPaymentMethod.map((row) => [row.method, String(row.count), formatMoney(row.amount)])}
              />
            </Panel>
          </div>
        ))}

      {tab === "products" &&
        (products === null ? (
          <Skeleton className="h-80 w-full" />
        ) : (
          <Panel title="Best sellers">
            <ReportTable
              head={["Product", "Units sold", "Revenue", "Rating", "Status"]}
              rows={products.map((row) => [
                row.name,
                String(row.unitsSold),
                formatMoney(row.revenue),
                `${row.rating.toFixed(1)} (${row.ratingCount})`,
                row.status,
              ])}
            />
          </Panel>
        ))}

      {tab === "customers" &&
        (customers === null ? (
          <Skeleton className="h-80 w-full" />
        ) : (
          <Panel title="Top customers">
            <ReportTable
              head={["Customer", "Orders", "Spend", "Last order", "Status"]}
              rows={customers.map((row) => [
                `${row.name} · ${row.email}`,
                String(row.orders),
                formatMoney(row.totalSpend),
                row.lastOrderAt ? formatDateTime(row.lastOrderAt) : "—",
                row.status,
              ])}
            />
          </Panel>
        ))}

      {tab === "coupons" &&
        (coupons === null ? (
          <Skeleton className="h-80 w-full" />
        ) : (
          <Panel title="Coupon performance">
            <ReportTable
              head={["Code", "Type", "Uses", "Discount given", "Active"]}
              rows={coupons.map((row) => [
                row.code,
                row.type === "PERCENTAGE" ? `${row.value}%` : formatMoney(row.value),
                `${row.totalUsages}`,
                formatMoney(row.discountGiven),
                row.active ? "Active" : "Inactive",
              ])}
            />
          </Panel>
        ))}
    </div>
  );
}

function ReportTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            {head.map((column) => (
              <th key={column} className="px-5 pb-2">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className={cellIndex === 0 ? "px-5 py-3 font-medium" : "px-5 py-3 text-muted-foreground"}>
                  {cellIndex === head.length - 1 ? <Badge variant="default">{cell}</Badge> : cell}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={head.length} className="px-5 py-8 text-center text-muted-foreground">
                No data in this period
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
