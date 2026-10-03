"use client";

import * as React from "react";
import { Ban, CheckCircle2, Search } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type { CustomerRow } from "@/lib/types";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty";
import { Pagination } from "@/components/ui/pagination";
import { Panel } from "@/components/admin/panels";

export default function AdminCustomersPage() {
  const [rows, setRows] = React.useState<CustomerRow[] | null>(null);
  const [meta, setMeta] = React.useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setRows(null);
    api
      .getFull<{ items: CustomerRow[] }>("/admin/customers", {
        query: { page, limit: 15, search: query || undefined, status: status || undefined },
      })
      .then(({ data, meta: pageMeta }) => {
        setRows(data.items);
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
  }, [page, query, status]);

  const toggle = async (row: CustomerRow) => {
    const next = row.status === "BLOCKED" ? "ACTIVE" : "BLOCKED";
    setBusyId(row.id);
    try {
      await api.patch(`/admin/customers/${row.id}/status`, { status: next });
      setRows((prev) => (prev ?? []).map((item) => (item.id === row.id ? { ...item, status: next } : item)));
      toast.success(`${row.firstName} is now ${next === "BLOCKED" ? "blocked" : "active"}`);
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
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-sm text-muted-foreground">{meta.total} registered shoppers</p>
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
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, phone" className="w-56 pl-9" />
          </div>
          <Select
            className="w-40"
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
            options={[
              { value: "", label: "All customers" },
              { value: "ACTIVE", label: "Active" },
              { value: "BLOCKED", label: "Blocked" },
            ]}
          />
          <Button type="submit" variant="outline">
            Filter
          </Button>
        </form>
      </div>

      <Panel title="Customers">
        {rows === null ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState icon="search" title="No customers found" description="Try a different search." />
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 pb-2">Customer</th>
                  <th className="px-5 pb-2">Joined</th>
                  <th className="px-5 pb-2">Orders</th>
                  <th className="px-5 pb-2">Reviews</th>
                  <th className="px-5 pb-2">Spend</th>
                  <th className="px-5 pb-2">Last order</th>
                  <th className="px-5 pb-2">Status</th>
                  <th className="px-5 pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-5 py-3">
                      <p className="font-medium">
                        {row.firstName} {row.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {row.email}
                        {row.phone ? ` · ${row.phone}` : ""}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDate(row.createdAt)}</td>
                    <td className="px-5 py-3 tabular-nums">{row.orderCount}</td>
                    <td className="px-5 py-3 tabular-nums">{row.reviewCount}</td>
                    <td className="px-5 py-3 font-semibold">{formatMoney(row.totalSpend)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{row.lastOrderAt ? formatDateTime(row.lastOrderAt) : "—"}</td>
                    <td className="px-5 py-3">
                      <Badge variant={row.status === "ACTIVE" ? "success" : "destructive"}>{row.status}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        variant={row.status === "ACTIVE" ? "ghost" : "outline"}
                        size="sm"
                        loading={busyId === row.id}
                        onClick={() => void toggle(row)}
                      >
                        {row.status === "ACTIVE" ? (
                          <>
                            <Ban className="h-3.5 w-3.5" /> Block
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" /> Restore
                          </>
                        )}
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
    </div>
  );
}
