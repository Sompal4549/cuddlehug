import type { Metadata } from "next";
import { ProductForm } from "@/components/admin/product-form";

export const metadata: Metadata = { title: "New product · CuddleHug Admin" };

export default function NewProductPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">New product</h1>
        <p className="text-sm text-muted-foreground">Add a teddy, its images, pricing and stock.</p>
      </div>
      <ProductForm />
    </div>
  );
}
