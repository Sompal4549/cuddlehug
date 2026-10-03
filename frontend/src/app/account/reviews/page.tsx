"use client";

import * as React from "react";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { api } from "@/lib/api";
import type { Review } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Stars } from "@/components/ui/stars";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty";

export default function MyReviewsPage() {
  const [reviews, setReviews] = React.useState<Review[] | null>(null);

  React.useEffect(() => {
    api
      .get<{ items: Review[] }>("/reviews/mine", { query: { limit: 50 } })
      .then((data) => setReviews(data.items))
      .catch(() => setReviews([]));
  }, []);

  if (reviews === null) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card">
        <EmptyState
          icon="orders"
          title="You have not reviewed anything yet"
          description="Bought a bear? Share the hug with other shoppers."
          action={
            <Link href="/account/orders">
              <Button>Go to your orders</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold">My reviews</h2>
      <ul className="space-y-3">
        {reviews.map((review) => (
          <li key={review.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Stars rating={review.rating} />
                  <span className="text-xs text-muted-foreground">{formatDate(review.createdAt)}</span>
                </div>
                <p className="mt-1.5 text-sm font-semibold">{review.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{review.comment}</p>
              </div>
              <Badge variant={review.status === "APPROVED" ? "success" : review.status === "REJECTED" ? "destructive" : "warning"}>
                {review.status === "APPROVED" ? "Published" : review.status === "REJECTED" ? "Not approved" : "Pending"}
              </Badge>
            </div>
            {review.product && (
              <Link
                href={`/products/${review.product.slug}`}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <MessageSquare className="h-3.5 w-3.5" /> {review.product.name}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
