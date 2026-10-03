"use client";

import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type { CouponAdmin } from "@/lib/types";
import { formatDate, formatMoney } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import { Panel } from "@/components/admin/panels";

const toLocalInput = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const emptyForm = {
  code: "",
  description: "",
  type: "PERCENTAGE",
  value: "",
  minOrderAmount: "0",
  maxDiscount: "",
  startsAt: "",
  endsAt: "",
  usageLimit: "",
  perUserLimit: "1",
};

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = React.useState<CouponAdmin[] | null>(null);
  const [meta, setMeta] = React.useState({ page: 1, totalPages: 1, total: 0 });
  const [page, setPage] = React.useState(1);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CouponAdmin | null>(null);
  const [form, setForm] = React.useState(emptyForm);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api
      .getFull<{ items: CouponAdmin[] }>("/admin/coupons", { query: { page, limit: 12 } })
      .then(({ data, meta: pageMeta }) => {
        setCoupons(data.items);
        setMeta({
          page: Number(pageMeta?.page ?? 1),
          totalPages: Number(pageMeta?.totalPages ?? 1),
          total: Number(pageMeta?.total ?? 0),
        });
      })
      .catch((err: unknown) => {
        setCoupons([]);
        toast.error(errorMessage(err));
      });
  }, [page]);

  React.useEffect(load, [load]);

  const openCreate = () => {
    setEditing(null);
    setError(null);
    setForm({ ...emptyForm, startsAt: toLocalInput(new Date().toISOString()), endsAt: "" });
    setOpen(true);
  };

  const openEdit = (coupon: CouponAdmin) => {
    setEditing(coupon);
    setError(null);
    setForm({
      code: coupon.code,
      description: coupon.description ?? "",
      type: coupon.type,
      value: coupon.value,
      minOrderAmount: coupon.minOrderAmount ?? "0",
      maxDiscount: coupon.maxDiscount ?? "",
      startsAt: toLocalInput(coupon.startsAt),
      endsAt: toLocalInput(coupon.endsAt),
      usageLimit: coupon.usageLimit === null ? "" : String(coupon.usageLimit),
      perUserLimit: String(coupon.perUserLimit),
    });
    setOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const payload = {
      code: form.code.trim().toUpperCase(),
      description: form.description.trim() || null,
      type: form.type as "PERCENTAGE" | "FIXED",
      value: form.value,
      minOrderAmount: form.minOrderAmount || "0",
      maxDiscount: form.maxDiscount ? form.maxDiscount : null,
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: new Date(form.endsAt).toISOString(),
      usageLimit: form.usageLimit ? Number(form.usageLimit) : null,
      perUserLimit: Number(form.perUserLimit || 1),
      active: true,
    };

    try {
      if (editing) {
        await api.patch(`/admin/coupons/${editing.id}`, payload);
        toast.success("Coupon updated");
      } else {
        await api.post("/admin/coupons", payload);
        toast.success("Coupon created");
      }
      setOpen(false);
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (coupon: CouponAdmin) => {
    try {
      const result = await api.delete<{ deleted?: boolean; deactivated?: boolean }>(`/admin/coupons/${coupon.id}`);
      toast.success(result?.deactivated ? "Coupon deactivated (it has historic usages)" : "Coupon deleted");
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Coupons</h1>
          <p className="text-sm text-muted-foreground">{meta.total} codes</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New coupon
        </Button>
      </div>

      <Panel title="All coupons">
        {coupons === null ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : coupons.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No coupons yet — create your first one.</p>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 pb-2">Code</th>
                  <th className="px-5 pb-2">Discount</th>
                  <th className="px-5 pb-2">Min order</th>
                  <th className="px-5 pb-2">Window</th>
                  <th className="px-5 pb-2">Used</th>
                  <th className="px-5 pb-2">Status</th>
                  <th className="px-5 pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {coupons.map((coupon) => (
                  <tr key={coupon.id}>
                    <td className="px-5 py-3">
                      <p className="font-mono font-semibold">{coupon.code}</p>
                      {coupon.description && <p className="text-xs text-muted-foreground">{coupon.description}</p>}
                    </td>
                    <td className="px-5 py-3">
                      {coupon.type === "PERCENTAGE" ? `${coupon.value}%` : formatMoney(coupon.value)}
                      {coupon.maxDiscount ? ` (cap ${formatMoney(coupon.maxDiscount)})` : ""}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{formatMoney(coupon.minOrderAmount)}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {formatDate(coupon.startsAt)} → {formatDate(coupon.endsAt)}
                    </td>
                    <td className="px-5 py-3 tabular-nums">
                      {coupon.usedCount}
                      {coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={coupon.active ? "success" : "default"}>{coupon.active ? "Active" : "Inactive"}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(coupon)}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button variant="ghost" size="iconSm" aria-label="Delete coupon" onClick={() => void remove(coupon)}>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader title={editing ? "Edit coupon" : "New coupon"} />
          <form onSubmit={submit} className="space-y-4">
            {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Code" required hint="Letters, numbers, - and _">
                <Input
                  required
                  value={form.code}
                  onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
                  placeholder="CUDDLE10"
                />
              </Field>
              <Field label="Type" required>
                <Select
                  value={form.type}
                  onChange={(event) => setForm({ ...form, type: event.target.value })}
                  options={[
                    { value: "PERCENTAGE", label: "Percentage" },
                    { value: "FIXED", label: "Fixed amount (₹)" },
                  ]}
                />
              </Field>
              <Field label={form.type === "PERCENTAGE" ? "Value (%)" : "Value (₹)"} required>
                <Input required inputMode="decimal" value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} />
              </Field>
              <Field label="Max discount (₹)" hint="For percentage coupons">
                <Input inputMode="decimal" value={form.maxDiscount} onChange={(event) => setForm({ ...form, maxDiscount: event.target.value })} />
              </Field>
              <Field label="Min order (₹)">
                <Input
                  inputMode="decimal"
                  value={form.minOrderAmount}
                  onChange={(event) => setForm({ ...form, minOrderAmount: event.target.value })}
                />
              </Field>
              <Field label="Per-user limit">
                <Input
                  inputMode="numeric"
                  value={form.perUserLimit}
                  onChange={(event) => setForm({ ...form, perUserLimit: event.target.value })}
                />
              </Field>
              <Field label="Starts">
                <Input
                  type="datetime-local"
                  required
                  value={form.startsAt}
                  onChange={(event) => setForm({ ...form, startsAt: event.target.value })}
                />
              </Field>
              <Field label="Ends">
                <Input
                  type="datetime-local"
                  required
                  value={form.endsAt}
                  onChange={(event) => setForm({ ...form, endsAt: event.target.value })}
                />
              </Field>
              <Field label="Total uses" hint="Leave blank for unlimited">
                <Input inputMode="numeric" value={form.usageLimit} onChange={(event) => setForm({ ...form, usageLimit: event.target.value })} />
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <Textarea
                  rows={2}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                {editing ? "Save changes" : "Create coupon"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
