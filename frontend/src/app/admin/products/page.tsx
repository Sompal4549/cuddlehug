"use client";

import * as React from "react";
import Link from "next/link";
import { Archive, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type { ProductCard } from "@/lib/types";
import { formatMoney } from "@/lib/format";
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
  { value: "ACTIVE", label: "Active" },
  { value: "DRAFT", label: "Draft" },
  { value: "ARCHIVED", label: "Archived" },
];

const STATUS_TONE = { ACTIVE: "success", DRAFT: "warning", ARCHIVED: "default" } as const;

export default function AdminProductsPage() {
  const [products, setProducts] = React.useState<ProductCard[] | null>(null);
  const [meta, setMeta] = React.useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setProducts(null);
    api
      .getFull<{ items: ProductCard[] }>("/admin/products", {
        query: { page, limit: 12, search: query || undefined, status: status || undefined, sort: "newest" },
      })
      .then(({ data, meta: pageMeta }) => {
        setProducts(data.items);
        setMeta({
          page: Number(pageMeta?.page ?? 1),
          totalPages: Number(pageMeta?.totalPages ?? 1),
          total: Number(pageMeta?.total ?? 0),
        });
      })
      .catch((error: unknown) => {
        setProducts([]);
        toast.error(errorMessage(error));
      });
  }, [page, query, status]);

  React.useEffect(load, [load]);

  const setStatusOf = async (product: ProductCard, next: "ACTIVE" | "DRAFT" | "ARCHIVED") => {
    setBusyId(product.id);
    try {
      await api.patch(`/admin/products/${product.id}/status`, { status: next });
      setProducts((prev) => (prev ?? []).map((row) => (row.id === product.id ? { ...row, status: next } : row)));
      toast.success(`${product.name} is now ${next.toLowerCase()}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const archive = async (product: ProductCard) => {
    setBusyId(product.id);
    try {
      await api.delete(`/admin/products/${product.id}`);
      toast.success("Product archived");
      load();
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
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground">{meta.total} products</p>
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
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name or SKU" className="w-52 pl-9" />
          </div>
          <Select
            className="w-40"
            options={STATUS_OPTIONS}
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
          />
          <Button type="submit" variant="outline">
            Filter
          </Button>
          <Link href="/admin/products/new">
            <Button>
              <Plus className="h-4 w-4" /> New product
            </Button>
          </Link>
        </form>
      </div>

      <Panel title="Catalogue">
        {products === null ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon="search"
            title="No products found"
            description="Try another search or add a new bear."
            action={
              <Link href="/admin/products/new">
                <Button>Add product</Button>
              </Link>
            }
          />
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 pb-2">Product</th>
                  <th className="px-5 pb-2">Category</th>
                  <th className="px-5 pb-2">Price</th>
                  <th className="px-5 pb-2">Stock</th>
                  <th className="px-5 pb-2">Status</th>
                  <th className="px-5 pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((product) => (
                  <tr key={product.id}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-md bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={product.image ?? "/images/09_product_pink_teddy.jpg"}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{product.category.name}</td>
                    <td className="px-5 py-3">
                      <span className="font-semibold">{formatMoney(product.price)}</span>
                      <span className="ml-1 text-xs text-muted-foreground line-through">{formatMoney(product.mrp)}</span>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={product.available === 0 ? "destructive" : product.lowStock ? "warning" : "default"}>
                        {product.available}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={STATUS_TONE[product.status]}>{product.status}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <Link href={`/admin/products/${product.id}`}>
                          <Button variant="outline" size="sm">
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                        </Link>
                        {product.status === "ACTIVE" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            loading={busyId === product.id}
                            onClick={() => void setStatusOf(product, "DRAFT")}
                          >
                            <Archive className="h-3.5 w-3.5" /> Unpublish
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            loading={busyId === product.id}
                            onClick={() => void setStatusOf(product, "ACTIVE")}
                          >
                            Publish
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="iconSm"
                          aria-label="Archive product"
                          loading={busyId === product.id}
                          onClick={() => void archive(product)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
