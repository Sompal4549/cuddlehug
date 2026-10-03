"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type { AdminReview } from "@/lib/types";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty";
import { Stars } from "@/components/ui/stars";
import { Pagination } from "@/components/ui/pagination";
import { Panel } from "@/components/admin/panels";

const TONE = { APPROVED: "success", REJECTED: "destructive", PENDING: "warning" } as const;

export default function AdminReviewsPage() {
  const [reviews, setReviews] = React.useState<AdminReview[] | null>(null);
  const [meta, setMeta] = React.useState({ page: 1, totalPages: 1, total: 0 });
  const [search, setSearch] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setReviews(null);
    api
      .getFull<{ items: AdminReview[] }>("/admin/reviews", {
        query: { page, limit: 15, search: query || undefined, status: status || undefined },
      })
      .then(({ data, meta: pageMeta }) => {
        setReviews(data.items);
        setMeta({
          page: Number(pageMeta?.page ?? 1),
          totalPages: Number(pageMeta?.totalPages ?? 1),
          total: Number(pageMeta?.total ?? 0),
        });
      })
      .catch((error: unknown) => {
        setReviews([]);
        toast.error(errorMessage(error));
      });
  }, [page, query, status]);

  const moderate = async (review: AdminReview, next: "APPROVED" | "REJECTED" | "PENDING") => {
    setBusyId(review.id);
    try {
      await api.patch(`/admin/reviews/${review.id}`, { status: next });
      setReviews((prev) => (prev ?? []).map((row) => (row.id === review.id ? { ...row, status: next } : row)));
      toast.success(`Review ${next.toLowerCase()}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (review: AdminReview) => {
    setBusyId(review.id);
    try {
      await api.delete(`/admin/reviews/${review.id}`);
      setReviews((prev) => (prev ?? []).filter((row) => row.id !== review.id));
      toast.success("Review deleted");
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
          <h1 className="text-2xl font-bold">Reviews</h1>
          <p className="text-sm text-muted-foreground">{meta.total} reviews</p>
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
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reviews" className="w-56 pl-9" />
          </div>
          <Select
            className="w-40"
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
            options={[
              { value: "", label: "All reviews" },
              { value: "PENDING", label: "Pending" },
              { value: "APPROVED", label: "Approved" },
              { value: "REJECTED", label: "Rejected" },
            ]}
          />
          <Button type="submit" variant="outline">
            Filter
          </Button>
        </form>
      </div>

      <Panel title="Moderation queue">
        {reviews === null ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-20 w-full" />
            ))}
          </div>
        ) : reviews.length === 0 ? (
          <EmptyState icon="search" title="Nothing to moderate" description="No reviews match this filter." />
        ) : (
          <ul className="divide-y divide-border">
            {reviews.map((review) => (
              <li key={review.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Stars rating={review.rating} size={13} />
                      <Badge variant={TONE[review.status]}>{review.status}</Badge>
                      <span className="text-xs text-muted-foreground">{formatDate(review.createdAt)}</span>
                    </div>
                    <p className="mt-1.5 text-sm font-semibold">{review.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{review.comment}</p>
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {review.user?.name ?? "Unknown"} on{" "}
                      {review.product ? (
                        <Link href={`/products/${review.product.slug}`} className="font-medium text-primary hover:underline">
                          {review.product.name}
                        </Link>
                      ) : (
                        "a product"
                      )}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {review.status !== "APPROVED" && (
                      <Button variant="outline" size="sm" loading={busyId === review.id} onClick={() => void moderate(review, "APPROVED")}>
                        <Check className="h-3.5 w-3.5" /> Approve
                      </Button>
                    )}
                    {review.status !== "REJECTED" && (
                      <Button variant="ghost" size="sm" loading={busyId === review.id} onClick={() => void moderate(review, "REJECTED")}>
                        <X className="h-3.5 w-3.5" /> Reject
                      </Button>
                    )}
                    <Button variant="ghost" size="iconSm" aria-label="Delete review" loading={busyId === review.id} onClick={() => void remove(review)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Pagination page={meta.page} totalPages={meta.totalPages} onChange={setPage} />
    </div>
  );
}
