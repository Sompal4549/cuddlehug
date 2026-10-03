"use client";

import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type { Category } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { Panel } from "@/components/admin/panels";

type AdminCategory = Category & {
  status: "ACTIVE" | "HIDDEN";
  parent?: { id: string; name: string } | null;
  parentId?: string | null;
  updatedAt?: string;
};

const emptyForm = { name: "", description: "", image: "", status: "ACTIVE", sortOrder: "0", parentId: "" };

export default function AdminCategoriesPage() {
  const [categories, setCategories] = React.useState<AdminCategory[] | null>(null);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<AdminCategory | null>(null);
  const [form, setForm] = React.useState(emptyForm);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    api
      .get<{ items: AdminCategory[] }>("/admin/categories")
      .then((data) => setCategories(data.items))
      .catch((err: unknown) => {
        setCategories([]);
        toast.error(errorMessage(err));
      });
  }, []);

  React.useEffect(load, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setOpen(true);
  };

  const openEdit = (category: AdminCategory) => {
    setEditing(category);
    setForm({
      name: category.name,
      description: category.description ?? "",
      image: category.image ?? "",
      status: category.status,
      sortOrder: String(category.sortOrder),
      parentId: category.parentId ?? "",
    });
    setError(null);
    setOpen(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      image: form.image.trim() || null,
      status: form.status as "ACTIVE" | "HIDDEN",
      sortOrder: Number(form.sortOrder || 0),
      parentId: form.parentId || null,
    };
    try {
      if (editing) {
        await api.patch(`/admin/categories/${editing.id}`, payload);
        toast.success("Category updated");
      } else {
        await api.post("/admin/categories", payload);
        toast.success("Category created");
      }
      setOpen(false);
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (category: AdminCategory) => {
    try {
      await api.delete(`/admin/categories/${category.id}`);
      toast.success("Category deleted");
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categories</h1>
          <p className="text-sm text-muted-foreground">Organise the shop aisles.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> New category
        </Button>
      </div>

      <Panel title="All categories">
        {categories === null ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <div className="-mx-5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 pb-2">Name</th>
                  <th className="px-5 pb-2">Slug</th>
                  <th className="px-5 pb-2">Products</th>
                  <th className="px-5 pb-2">Status</th>
                  <th className="px-5 pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td className="px-5 py-3 font-medium">{category.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{category.slug}</td>
                    <td className="px-5 py-3 text-muted-foreground">{category.productCount}</td>
                    <td className="px-5 py-3">
                      <Badge variant={category.status === "ACTIVE" ? "success" : "default"}>{category.status}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(category)}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        <Button variant="ghost" size="iconSm" aria-label="Delete category" onClick={() => void remove(category)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {categories.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                      No categories yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader title={editing ? "Edit category" : "New category"} />
          <form onSubmit={submit} className="space-y-4">
            {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" required>
                <Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </Field>
              <Field label="Status">
                <Select
                  value={form.status}
                  onChange={(event) => setForm({ ...form, status: event.target.value })}
                  options={[
                    { value: "ACTIVE", label: "Active" },
                    { value: "HIDDEN", label: "Hidden" },
                  ]}
                />
              </Field>
              <Field label="Image path" className="sm:col-span-2">
                <Input
                  value={form.image}
                  onChange={(event) => setForm({ ...form, image: event.target.value })}
                  placeholder="/images/06_shop_banner_teddy.jpg"
                />
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <Textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
              </Field>
              <Field label="Sort order">
                <Input inputMode="numeric" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} />
              </Field>
              <Field label="Parent category">
                <Select
                  value={form.parentId}
                  onChange={(event) => setForm({ ...form, parentId: event.target.value })}
                  placeholder="None"
                  options={(categories ?? [])
                    .filter((category) => category.id !== editing?.id)
                    .map((category) => ({ value: category.id, label: category.name }))}
                />
              </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                {editing ? "Save changes" : "Create category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
