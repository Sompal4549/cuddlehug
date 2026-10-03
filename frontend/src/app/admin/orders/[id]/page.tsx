"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Package, Truck } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type { Order } from "@/lib/types";
import { formatDateTime, formatMoney, ORDER_STATUS_FLOW, ORDER_STATUS_LABELS, orderStatusTone } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel } from "@/components/admin/panels";

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = React.useState<Order | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [nextStatus, setNextStatus] = React.useState("");
  const [note, setNote] = React.useState("");
  const [trackingNumber, setTrackingNumber] = React.useState("");
  const [courierName, setCourierName] = React.useState("");
  const [cancelReason, setCancelReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    api
      .get<Order>(`/admin/orders/${params.id}`)
      .then((data) => {
        setOrder(data);
        setTrackingNumber(data.trackingNumber ?? "");
        setCourierName(data.courierName ?? "");
        setCancelReason(data.cancelReason ?? "");
        const first = ORDER_STATUS_FLOW[data.status]?.[0] ?? "";
        setNextStatus(first);
      })
      .catch((err: unknown) => setError(errorMessage(err)));
  }, [params.id]);

  const transitions = order ? (ORDER_STATUS_FLOW[order.status] ?? []) : [];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!order || !nextStatus || nextStatus === order.status) return;
    setBusy(true);
    try {
      const updated = await api.patch<Order>(`/admin/orders/${order.id}/status`, {
        status: nextStatus,
        note: note || undefined,
        trackingNumber: trackingNumber || undefined,
        courierName: courierName || undefined,
        cancelReason: nextStatus === "CANCELLED" ? cancelReason || undefined : undefined,
      });
      setOrder(updated);
      setNote("");
      toast.success(`Order updated to ${ORDER_STATUS_LABELS[updated.status]}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="space-y-4">
        <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={() => router.push("/admin/orders")}>
          <ArrowLeft className="h-4 w-4" /> Back to orders
        </Button>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const address = order.shippingAddress as Record<string, string>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/orders">
            <Button variant="ghost" size="iconSm" aria-label="Back to orders">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
              <Badge variant={orderStatusTone(order.status)}>{ORDER_STATUS_LABELS[order.status]}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">Placed {formatDateTime(order.createdAt)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Order total</p>
          <p className="text-xl font-bold">{formatMoney(order.totalAmount)}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Items" className="lg:col-span-2">
          <ul className="divide-y divide-border">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.imageUrl ?? "/images/09_product_pink_teddy.jpg"} alt={item.productName} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <Link href={`/products/${item.productSlug}`} className="block truncate font-medium hover:text-primary">
                    {item.productName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {item.variantLabel} · {formatMoney(item.unitPrice)} × {item.quantity}
                  </p>
                </div>
                <p className="font-semibold">{formatMoney(item.lineTotal)}</p>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
            <Row label="Subtotal" value={formatMoney(order.subtotal)} />
            {Number(order.discountAmount) > 0 && (
              <Row label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`} value={`− ${formatMoney(order.discountAmount)}`} />
            )}
            <Row label="Shipping" value={formatMoney(order.shippingAmount)} />
            <Row label="Tax (GST)" value={formatMoney(order.taxAmount)} />
            <Row label="Total" value={formatMoney(order.totalAmount)} strong />
          </dl>
        </Panel>

        <div className="space-y-4">
          <Panel title="Customer">
            {order.user ? (
              <div className="space-y-1 text-sm">
                <p className="font-semibold">
                  {order.user.firstName} {order.user.lastName}
                </p>
                <p className="text-muted-foreground">{order.user.email}</p>
                <p className="text-muted-foreground">{order.user.phone ?? "—"}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Guest checkout</p>
            )}
            <dl className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
              <Row label="Payment" value={`${order.paymentMethod} · ${order.paymentStatus}`} />
              {order.paidAt && <Row label="Paid at" value={formatDateTime(order.paidAt)} />}
              {order.couponCode && <Row label="Coupon" value={order.couponCode} />}
            </dl>
          </Panel>

          <Panel title="Shipping address">
            <address className="not-italic text-sm leading-relaxed text-muted-foreground">
              {address.fullName ?? "—"}
              <br />
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ""}
              <br />
              {address.city}, {address.state} {address.pincode}
              <br />
              {address.phone}
            </address>
          </Panel>

          <Panel title="Tracking">
            <dl className="space-y-1 text-sm">
              <Row label="Courier" value={order.courierName ?? "—"} />
              <Row label="Tracking #" value={order.trackingNumber ?? "—"} />
              <Row label="ETA" value={order.estimatedDelivery ? formatDateTime(order.estimatedDelivery) : "—"} />
              {order.cancelReason && <Row label="Cancel reason" value={order.cancelReason} />}
            </dl>
          </Panel>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Update status">
          {transitions.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-success" /> This order is in a final state.
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Move to" required>
                  <Select
                    required
                    value={nextStatus}
                    onChange={(event) => setNextStatus(event.target.value)}
                    options={[
                      { value: "", label: "Choose a status" },
                      ...transitions.map((value) => ({ value, label: ORDER_STATUS_LABELS[value] })),
                    ]}
                  />
                </Field>
                <Field label="Courier">
                  <Input value={courierName} onChange={(event) => setCourierName(event.target.value)} placeholder="Blue Dart" />
                </Field>
                <Field label="Tracking number" className="sm:col-span-2">
                  <Input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} placeholder="BD123456789" />
                </Field>
                {nextStatus === "CANCELLED" && (
                  <Field label="Cancel reason" required className="sm:col-span-2">
                    <Textarea required value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} rows={2} />
                  </Field>
                )}
                <Field label="Internal note" className="sm:col-span-2">
                  <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} placeholder="Optional note for the timeline" />
                </Field>
              </div>
              <div className="flex gap-3">
                <Button type="submit" loading={busy} disabled={!nextStatus || nextStatus === order.status}>
                  <Truck className="h-4 w-4" /> Update order
                </Button>
                <Button type="button" variant="ghost" onClick={() => router.push("/admin/orders")}>
                  Done
                </Button>
              </div>
            </form>
          )}
        </Panel>

        <Panel title="Timeline">
          {order.history && order.history.length > 0 ? (
            <ol className="relative space-y-4 border-l border-border pl-5">
              {order.history.map((entry) => (
                <li key={entry.id} className="relative">
                  <span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-card" />
                  <p className="text-sm font-semibold">
                    {ORDER_STATUS_LABELS[entry.status] ?? entry.status}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">{formatDateTime(entry.createdAt)}</span>
                  </p>
                  {entry.note && <p className="text-sm text-muted-foreground">{entry.note}</p>}
                </li>
              ))}
            </ol>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" /> No status changes recorded yet.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${strong ? "font-bold" : ""}`}>
      <dt className={strong ? "" : "text-muted-foreground"}>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
