"use client";

import * as React from "react";
import { ArrowDownUp, Search } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type { InventoryAdminRow, InventoryTransaction } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import { Panel, StatCard } from "@/components/admin/panels";

type Summary = {
  totalVariants: number;
  totalUnits: number;
  totalReserved: number;
  outOfStock: number;
  lowStock: number;
};

const ADJUST_TYPES = [
  { value: "STOCK_ADDED", label: "Stock received" },
  { value: "STOCK_REMOVED", label: "Stock removed" },
  { value: "MANUAL_ADJUSTMENT", label: "Manual correction" },
  { value: "RETURN", label: "Return restocked" },
];

export default function AdminInventoryPage() {
  const [tab, setTab] = React.useState("stock");
  const [rows, setRows] = React.useState<InventoryAdminRow[] | null>(null);
  const [summary, setSummary] = React.useState<Summary | null>(null);
  const [meta, setMeta] = React.useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [lowOnly, setLowOnly] = React.useState(false);
  const [page, setPage] = React.useState(1);

  const [target, setTarget] = React.useState<InventoryAdminRow | null>(null);
  const [adjustType, setAdjustType] = React.useState("STOCK_ADDED");
  const [quantity, setQuantity] = React.useState("1");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setRows(null);
    api
      .getFull<{ items: InventoryAdminRow[]; summary: Summary }>("/admin/inventory", {
        query: { page, limit: 20, search: query || undefined, lowOnly: lowOnly || undefined },
      })
      .then(({ data, meta: pageMeta }) => {
        setRows(data.items);
        setSummary(data.summary);
        setMeta({
          page: Number(pageMeta?.page ?? 1),
          totalPages: Number(pageMeta?.totalPages ?? 1),
          total: Number(pageMeta?.total ?? 0),
        });
      })
      .catch((error: unknown) => {
        setRows([]);
        toast.error(errorMessage(error));
      });
  }, [page, query, lowOnly]);

  const adjust = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!target) return;
    setBusy(true);
    try {
      await api.post("/admin/inventory/adjust", {
        variantId: target.variantId,
        type: adjustType,
        quantity: Number(quantity),
        note: note || undefined,
      });
      toast.success("Stock updated");
      setTarget(null);
      setNote("");
      setQuantity("1");
      setLowOnly((value) => value);
      setPage((value) => value);
      reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const reload = () => {
    api
      .getFull<{ items: InventoryAdminRow[]; summary: Summary }>("/admin/inventory", {
        query: { page, limit: 20, search: query || undefined, lowOnly: lowOnly || undefined },
      })
      .then(({ data, meta: pageMeta }) => {
        setRows(data.items);
        setSummary(data.summary);
        setMeta({
          page: Number(pageMeta?.page ?? 1),
          totalPages: Number(pageMeta?.totalPages ?? 1),
          total: Number(pageMeta?.total ?? 0),
        });
      })
      .catch(() => undefined);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Inventory</h1>
        <p className="text-sm text-muted-foreground">Stock levels across every variant.</p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <StatCard label="Variants" value={summary.totalVariants} />
          <StatCard label="Units" value={summary.totalUnits} />
          <StatCard label="Reserved" value={summary.totalReserved} />
          <StatCard label="Out of stock" value={summary.outOfStock} />
          <StatCard label="Low stock" value={summary.lowStock} />
        </div>
      )}

      <Tabs
        items={[
          { value: "stock", label: "Stock" },
          { value: "movements", label: "Movements" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "stock" ? (
        <>
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setPage(1);
              setQuery(search.trim());
            }}
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="SKU or product" className="w-56 pl-9" />
            </div>
            <Button type="submit" variant="outline">
              Search
            </Button>
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={lowOnly}
                onChange={(event) => {
                  setPage(1);
                  setLowOnly(event.target.checked);
                }}
                className="h-4 w-4 rounded border-input accent-[#e0674f]"
              />
              Low & out of stock only
            </label>
          </form>

          <Panel title={`Stock levels (${meta.total})`}>
            {rows === null ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No variants match.</p>
            ) : (
              <div className="-mx-5 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-5 pb-2">Product</th>
                      <th className="px-5 pb-2">SKU</th>
                      <th className="px-5 pb-2">Size / colour</th>
                      <th className="px-5 pb-2">Qty</th>
                      <th className="px-5 pb-2">Reserved</th>
                      <th className="px-5 pb-2">Available</th>
                      <th className="px-5 pb-2">Last movement</th>
                      <th className="px-5 pb-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {rows.map((row) => (
                      <tr key={row.variantId}>
                        <td className="px-5 py-3 font-medium">{row.product.name}</td>
                        <td className="px-5 py-3 text-muted-foreground">{row.sku}</td>
                        <td className="px-5 py-3 text-muted-foreground">
                          {row.size} / {row.color}
                        </td>
                        <td className="px-5 py-3 tabular-nums">{row.quantity}</td>
                        <td className="px-5 py-3 tabular-nums text-muted-foreground">{row.reserved}</td>
                        <td className="px-5 py-3">
                          <Badge variant={row.available === 0 ? "destructive" : row.available <= row.lowStockThreshold ? "warning" : "default"}>
                            {row.available}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-xs text-muted-foreground">
                          {row.lastMovement
                            ? `${row.lastMovement.type} (${row.lastMovement.delta > 0 ? "+" : ""}${row.lastMovement.delta}) · ${formatDateTime(row.lastMovement.at)}`
                            : "—"}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Button variant="outline" size="sm" onClick={() => setTarget(row)}>
                            <ArrowDownUp className="h-3.5 w-3.5" /> Adjust
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} />
        </>
      ) : (
        <MovementsPanel />
      )}

      <Dialog open={Boolean(target)} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader
            title="Adjust stock"
            description={target ? `${target.product.name} · ${target.size} / ${target.color} · ${target.sku}` : ""}
          />
          <form onSubmit={adjust} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Reason" required>
                <Select value={adjustType} onChange={(event) => setAdjustType(event.target.value)} options={ADJUST_TYPES} />
              </Field>
              <Field label="Quantity" required>
                <Input
                  required
                  inputMode="numeric"
                  min={1}
                  max={10000}
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              </Field>
              <Field label="Note" className="sm:col-span-2">
                <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Apply adjustment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MovementsPanel() {
  const [items, setItems] = React.useState<InventoryTransaction[] | null>(null);
  const [meta, setMeta] = React.useState({ page: 1, totalPages: 1 });
  const [page, setPage] = React.useState(1);
  const [type, setType] = React.useState("");

  React.useEffect(() => {
    setItems(null);
    api
      .getFull<{ items: InventoryTransaction[] }>("/admin/inventory/transactions", {
        query: { page, limit: 20, type: type || undefined },
      })
      .then(({ data, meta: pageMeta }) => {
        setItems(data.items);
        setMeta({ page: Number(pageMeta?.page ?? 1), totalPages: Number(pageMeta?.totalPages ?? 1) });
      })
      .catch((error: unknown) => {
        setItems([]);
        toast.error(errorMessage(error));
      });
  }, [page, type]);

  return (
    <div className="space-y-4">
      <Select
        className="w-64"
        value={type}
        onChange={(event) => {
          setPage(1);
          setType(event.target.value);
        }}
        options={[
          { value: "", label: "All movements" },
          { value: "STOCK_ADDED", label: "Stock added" },
          { value: "STOCK_REMOVED", label: "Stock removed" },
          { value: "ORDER_RESERVATION", label: "Order reservation" },
          { value: "ORDER_CANCELLATION", label: "Order cancellation" },
          { value: "RETURN", label: "Return" },
          { value: "MANUAL_ADJUSTMENT", label: "Manual adjustment" },
        ]}
      />

      <Panel title="Movements">
        {items === null ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No movements recorded.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 pb-2">When</th>
                  <th className="px-5 pb-2">Type</th>
                  <th className="px-5 pb-2">Product</th>
                  <th className="px-5 pb-2">SKU</th>
                  <th className="px-5 pb-2">Delta</th>
                  <th className="px-5 pb-2">By</th>
                  <th className="px-5 pb-2">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-5 py-3 text-muted-foreground">{formatDateTime(item.createdAt)}</td>
                    <td className="px-5 py-3">
                      <Badge variant={item.delta > 0 ? "success" : "destructive"}>{item.type.replaceAll("_", " ")}</Badge>
                    </td>
                    <td className="px-5 py-3 font-medium">{item.variant.product.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{item.variant.sku}</td>
                    <td className="px-5 py-3 font-semibold tabular-nums">
                      {item.delta > 0 ? "+" : ""}
                      {item.delta}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{item.actor ?? "System"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{item.note ?? "—"}</td>
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
