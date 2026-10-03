"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Star, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { api, apiUrl, errorMessage } from "@/lib/api";
import type { AdminProduct, Category, ProductColor, ProductSize } from "@/lib/types";
import { PRODUCT_COLORS, PRODUCT_SIZES } from "@/lib/types";
import { formatMoney } from "@/lib/format";
import { resolveAssetUrl } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ImageRow = { url: string; alt: string; isPrimary: boolean };
type VariantRow = {
  id?: string;
  size: ProductSize;
  color: ProductColor;
  sku: string;
  mrp: string;
  price: string;
  stock: string;
  lowStockThreshold: string;
  isActive: boolean;
};

const SUGGESTED_IMAGES = [
  "/images/08_product_brown_teddy.jpg",
  "/images/09_product_pink_teddy.jpg",
  "/images/10_product_white_teddy.jpg",
  "/images/12_shop_brown_teddy.jpg",
  "/images/13_shop_pink_teddy.jpg",
  "/images/14_shop_white_giant_teddy.jpg",
  "/images/16_product_detail_main_teddy.jpg",
  "/images/19_product_giant_teddy.jpg",
];

function emptyVariant(): VariantRow {
  return {
    size: "MEDIUM",
    color: "BROWN",
    sku: "",
    mrp: "",
    price: "",
    stock: "0",
    lowStockThreshold: "5",
    isActive: true,
  };
}

type FormState = {
  name: string;
  sku: string;
  categoryId: string;
  status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  mrp: string;
  price: string;
  discountPercent: string;
  lowStockThreshold: string;
  shortDescription: string;
  description: string;
  material: string;
  filling: string;
  weightGrams: string;
  careInstructions: string;
  ageRecommendation: string;
  tags: string;
  isFeatured: boolean;
  isBestSeller: boolean;
  isNewArrival: boolean;
  images: ImageRow[];
  variants: VariantRow[];
};

function toFormState(product?: AdminProduct): FormState {
  if (!product) {
    return {
      name: "",
      sku: "",
      categoryId: "",
      status: "DRAFT",
      mrp: "",
      price: "",
      discountPercent: "0",
      lowStockThreshold: "5",
      shortDescription: "",
      description: "",
      material: "Super-soft polyester plush",
      filling: "Hypoallergenic hollow fibre",
      weightGrams: "",
      careInstructions: "Hand wash cold, air dry flat",
      ageRecommendation: "3+ years",
      tags: "",
      isFeatured: false,
      isBestSeller: false,
      isNewArrival: false,
      images: [],
      variants: [emptyVariant()],
    };
  }

  return {
    name: product.name,
    sku: product.sku,
    categoryId: product.categoryId,
    status: product.status,
    mrp: product.mrp,
    price: product.price,
    discountPercent: String(product.discountPercent),
    lowStockThreshold: String(product.lowStockThreshold),
    shortDescription: product.shortDescription ?? "",
    description: product.description,
    material: product.material ?? "",
    filling: product.filling ?? "",
    weightGrams: product.weightGrams === null ? "" : String(product.weightGrams),
    careInstructions: product.careInstructions ?? "",
    ageRecommendation: product.ageRecommendation ?? "",
    tags: product.tags.join(", "),
    isFeatured: product.isFeatured,
    isBestSeller: product.isBestSeller,
    isNewArrival: product.isNewArrival,
    images: product.images.map((image) => ({ url: image.url, alt: image.alt, isPrimary: image.isPrimary })),
    variants: product.variants.map((variant) => ({
      id: variant.id,
      size: variant.size,
      color: variant.color,
      sku: variant.sku,
      mrp: variant.mrp,
      price: variant.price,
      stock: variant.inventory ? String(variant.inventory.quantity) : "0",
      lowStockThreshold: variant.inventory ? String(variant.inventory.lowStockThreshold) : "5",
      isActive: variant.isActive,
    })),
  };
}

export function ProductForm({ productId }: { productId?: string }) {
  const router = useRouter();
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [form, setForm] = React.useState<FormState | null>(productId ? null : toFormState());
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [newImageUrl, setNewImageUrl] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api
      .get<{ items: Category[] }>("/admin/categories")
      .then((data) => setCategories(data.items))
      .catch(() => setCategories([]));
  }, []);

  React.useEffect(() => {
    if (!productId) return;
    api
      .get<AdminProduct>(`/admin/products/${productId}`)
      .then((data) => setForm(toFormState(data)))
      .catch((err: unknown) => setError(errorMessage(err)));
  }, [productId]);

  const patch = (next: Partial<FormState>) => setForm((prev) => (prev ? { ...prev, ...next } : prev));

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const body = new FormData();
      body.append("image", file);
      const res = await fetch(apiUrl("/admin/uploads"), { method: "POST", credentials: "include", body });
      const payload = (await res.json()) as { success?: boolean; data?: { url: string }; message?: string };
      if (!res.ok || !payload.success || !payload.data) throw new Error(payload.message ?? "Upload failed");
      setForm((prev) =>
        prev
          ? {
              ...prev,
              images: [...prev.images, { url: payload.data!.url, alt: prev.name, isPrimary: prev.images.length === 0 }],
            }
          : prev,
      );
      toast.success("Image uploaded");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    if (form.images.length === 0) {
      toast.error("Add at least one image");
      return;
    }
    if (form.variants.length === 0) {
      toast.error("Add at least one variant");
      return;
    }

    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim(),
      categoryId: form.categoryId,
      status: form.status,
      mrp: form.mrp,
      price: form.price,
      discountPercent: Number(form.discountPercent || 0),
      lowStockThreshold: Number(form.lowStockThreshold || 0),
      shortDescription: form.shortDescription.trim() || null,
      description: form.description.trim(),
      material: form.material.trim() || null,
      filling: form.filling.trim() || null,
      weightGrams: form.weightGrams ? Number(form.weightGrams) : null,
      careInstructions: form.careInstructions.trim() || null,
      ageRecommendation: form.ageRecommendation.trim() || null,
      tags: form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      isFeatured: form.isFeatured,
      isBestSeller: form.isBestSeller,
      isNewArrival: form.isNewArrival,
      images: form.images.map((image, index) => ({
        url: image.url,
        alt: image.alt || form.name,
        position: index,
        isPrimary: index === 0,
      })),
      variants: form.variants.map((variant) => ({
        ...(variant.id ? { id: variant.id } : {}),
        size: variant.size,
        color: variant.color,
        sku: variant.sku.trim(),
        mrp: variant.mrp,
        price: variant.price,
        isActive: variant.isActive,
        stock: Number(variant.stock || 0),
        lowStockThreshold: Number(variant.lowStockThreshold || 0),
      })),
    };

    if (Number(payload.price) > Number(payload.mrp)) {
      setError("Selling price cannot be higher than MRP");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (productId) {
        await api.patch(`/admin/products/${productId}`, payload);
        toast.success("Product updated");
      } else {
        await api.post("/admin/products", payload);
        toast.success("Product created");
        router.push("/admin/products");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!form) {
    return <p className="text-sm text-muted-foreground">{error ?? "Loading product…"}</p>;
  }

  const mrp = Number(form.mrp);
  const price = Number(form.price);
  const computedDiscount = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;

  return (
    <form onSubmit={submit} className="space-y-5">
      {error && <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Product name" required className="sm:col-span-2">
            <Input required minLength={3} value={form.name} onChange={(event) => patch({ name: event.target.value })} />
          </Field>
          <Field label="SKU" required hint="Product-level code, e.g. CH-CLS-101">
            <Input required value={form.sku} onChange={(event) => patch({ sku: event.target.value })} />
          </Field>
          <Field label="Category" required>
            <Select
              required
              value={form.categoryId}
              onChange={(event) => patch({ categoryId: event.target.value })}
              placeholder="Choose a category"
              options={categories.map((category) => ({ value: category.id, label: category.name }))}
            />
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onChange={(event) => patch({ status: event.target.value as FormState["status"] })}
              options={[
                { value: "DRAFT", label: "Draft" },
                { value: "ACTIVE", label: "Active" },
                { value: "ARCHIVED", label: "Archived" },
              ]}
            />
          </Field>
          <Field label="Tags" hint="Comma separated, e.g. classic, gift, 3+">
            <Input value={form.tags} onChange={(event) => patch({ tags: event.target.value })} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          <Field label="MRP (₹)" required>
            <Input required inputMode="decimal" value={form.mrp} onChange={(event) => patch({ mrp: event.target.value })} />
          </Field>
          <Field label="Selling price (₹)" required>
            <Input required inputMode="decimal" value={form.price} onChange={(event) => patch({ price: event.target.value })} />
          </Field>
          <Field label="Discount %">
            <Input
              inputMode="numeric"
              value={form.discountPercent}
              onChange={(event) => patch({ discountPercent: event.target.value })}
            />
          </Field>
          <Field label="Low stock alert">
            <Input
              inputMode="numeric"
              value={form.lowStockThreshold}
              onChange={(event) => patch({ lowStockThreshold: event.target.value })}
            />
          </Field>
          <p className="text-xs text-muted-foreground sm:col-span-4">
            {computedDiscount > 0
              ? `${formatMoney(form.price)} is ${computedDiscount}% off ${formatMoney(form.mrp)}`
              : "Set an MRP above the selling price to show a discount."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Short description" hint="Shown on cards, max 300 characters">
            <Textarea rows={2} value={form.shortDescription} onChange={(event) => patch({ shortDescription: event.target.value })} />
          </Field>
          <Field label="Full description" required>
            <Textarea required minLength={10} rows={6} value={form.description} onChange={(event) => patch({ description: event.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Material">
              <Input value={form.material} onChange={(event) => patch({ material: event.target.value })} />
            </Field>
            <Field label="Filling">
              <Input value={form.filling} onChange={(event) => patch({ filling: event.target.value })} />
            </Field>
            <Field label="Weight (g)">
              <Input inputMode="numeric" value={form.weightGrams} onChange={(event) => patch({ weightGrams: event.target.value })} />
            </Field>
            <Field label="Care instructions">
              <Input value={form.careInstructions} onChange={(event) => patch({ careInstructions: event.target.value })} />
            </Field>
            <Field label="Age recommendation">
              <Input value={form.ageRecommendation} onChange={(event) => patch({ ageRecommendation: event.target.value })} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-4">
            <Toggle label="Featured" checked={form.isFeatured} onChange={(value) => patch({ isFeatured: value })} />
            <Toggle label="Best seller" checked={form.isBestSeller} onChange={(value) => patch({ isBestSeller: value })} />
            <Toggle label="New arrival" checked={form.isNewArrival} onChange={(value) => patch({ isNewArrival: value })} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Images</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            {form.images.map((image, index) => (
              <div key={`${image.url}-${index}`} className="w-36 overflow-hidden rounded-lg border border-border bg-muted">
                <div className="relative aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={resolveAssetUrl(image.url)} alt={image.alt} className="h-full w-full object-cover" />
                  {index === 0 && (
                    <span className="absolute left-1.5 top-1.5">
                      <Badge variant="primary">
                        <Star className="h-3 w-3" /> Primary
                      </Badge>
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-1 bg-card px-2 py-1.5">
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() =>
                      setForm((prev) => {
                        if (!prev) return prev;
                        const images = [...prev.images];
                        const [moved] = images.splice(index, 1);
                        images.unshift(moved);
                        return { ...prev, images };
                      })
                    }
                  >
                    Make primary
                  </button>
                  <button
                    type="button"
                    aria-label="Remove image"
                    className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setForm((prev) => (prev ? { ...prev, images: prev.images.filter((_, i) => i !== index) } : prev))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <Field label="Image path or URL">
              <Input
                value={newImageUrl}
                onChange={(event) => setNewImageUrl(event.target.value)}
                placeholder="/images/08_product_brown_teddy.jpg"
              />
            </Field>
            <div className="flex items-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={!newImageUrl.trim()}
                onClick={() => {
                  const url = newImageUrl.trim();
                  setForm((prev) =>
                    prev
                      ? {
                          ...prev,
                          images: [...prev.images, { url, alt: prev.name, isPrimary: prev.images.length === 0 }],
                        }
                      : prev,
                  );
                  setNewImageUrl("");
                }}
              >
                <Plus className="h-4 w-4" /> Add
              </Button>
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-4 text-sm font-semibold hover:border-primary hover:text-primary">
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading…" : "Upload"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadFile(file);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {SUGGESTED_IMAGES.map((image) => (
              <button
                key={image}
                type="button"
                className="h-12 w-12 overflow-hidden rounded-md border border-border hover:border-primary"
                onClick={() =>
                  setForm((prev) =>
                    prev
                      ? { ...prev, images: [...prev.images, { url: image, alt: prev.name, isPrimary: prev.images.length === 0 }] }
                      : prev,
                  )
                }
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Variants</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={() => patch({ variants: [...form.variants, emptyVariant()] })}>
            <Plus className="h-4 w-4" /> Add variant
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.variants.map((variant, index) => (
            <div key={variant.id ?? `new-${index}`} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-6">
              <Field label="Size">
                <Select
                  value={variant.size}
                  onChange={(event) => updateVariant(index, { size: event.target.value as ProductSize })}
                  options={PRODUCT_SIZES.map((size) => ({ value: size, label: size }))}
                />
              </Field>
              <Field label="Colour">
                <Select
                  value={variant.color}
                  onChange={(event) => updateVariant(index, { color: event.target.value as ProductColor })}
                  options={PRODUCT_COLORS.map((color) => ({ value: color, label: color }))}
                />
              </Field>
              <Field label="Variant SKU" required>
                <Input required value={variant.sku} onChange={(event) => updateVariant(index, { sku: event.target.value })} />
              </Field>
              <Field label="MRP (₹)" required>
                <Input required inputMode="decimal" value={variant.mrp} onChange={(event) => updateVariant(index, { mrp: event.target.value })} />
              </Field>
              <Field label="Price (₹)" required>
                <Input
                  required
                  inputMode="decimal"
                  value={variant.price}
                  onChange={(event) => updateVariant(index, { price: event.target.value })}
                />
              </Field>
              <Field label="Stock">
                <Input
                  inputMode="numeric"
                  value={variant.stock}
                  onChange={(event) => updateVariant(index, { stock: event.target.value })}
                />
              </Field>
              <div className="flex items-end justify-between gap-2 sm:col-span-6">
                <Toggle
                  label="Active"
                  checked={variant.isActive}
                  onChange={(value) => updateVariant(index, { isActive: value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={form.variants.length === 1}
                  onClick={() => patch({ variants: form.variants.filter((_, i) => i !== index) })}
                >
                  <Trash2 className="h-4 w-4" /> Remove
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" loading={busy}>
          {productId ? "Save changes" : "Create product"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => window.history.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );

  function updateVariant(index: number, next: Partial<VariantRow>) {
    setForm((prev) =>
      prev ? { ...prev, variants: prev.variants.map((variant, i) => (i === index ? { ...variant, ...next } : variant)) } : prev,
    );
  }
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-input accent-[#e0674f]"
      />
      {label}
    </label>
  );
}
