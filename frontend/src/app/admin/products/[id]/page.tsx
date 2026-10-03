"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { ProductForm } from "@/components/admin/product-form";

export default function EditProductPage() {
  const params = useParams<{ id: string }>();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Edit product</h1>
        <p className="text-sm text-muted-foreground">Update details, images, pricing and variants.</p>
      </div>
      <ProductForm productId={params.id} />
    </div>
  );
}
