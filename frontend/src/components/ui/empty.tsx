import * as React from "react";
import { Heart, PackageSearch, SearchX, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

const icons = {
  cart: ShoppingBag,
  search: SearchX,
  orders: PackageSearch,
  wishlist: Heart,
};

export function EmptyState({
  icon = "cart",
  title,
  description,
  action,
  className,
}: {
  icon?: keyof typeof icons;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  const Icon = icons[icon];
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-16 text-center", className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <div>
        <p className="text-base font-semibold">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
