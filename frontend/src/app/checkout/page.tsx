"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, CreditCard, Banknote, Loader2, Plus, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { useSession } from "@/lib/session";
import { formatMoney } from "@/lib/format";
import type { Address, Order, StoreSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty";

type PaymentMethod = "RAZORPAY" | "COD";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const { status, user } = useSession();
  const { cart, clear, loading: cartLoading } = useCart();

  const [addresses, setAddresses] = React.useState<Address[]>([]);
  const [addressId, setAddressId] = React.useState<string>("");
  const [showForm, setShowForm] = React.useState(false);
  const [settings, setSettings] = React.useState<StoreSettings | null>(null);
  const [method, setMethod] = React.useState<PaymentMethod>("RAZORPAY");
  const [placing, setPlacing] = React.useState(false);
  const [stage, setStage] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (status === "guest") {
      router.replace("/login?next=/checkout");
      return;
    }
    if (status !== "authenticated") return;

    void (async () => {
      try {
        const [addressList, storeSettings] = await Promise.all([
          api.get<{ items: Address[] }>("/addresses"),
          api.get<StoreSettings>("/settings"),
        ]);
        setAddresses(addressList.items);
        setSettings(storeSettings);
        setAddressId(addressList.items.find((address) => address.isDefault)?.id ?? addressList.items[0]?.id ?? "");
        setShowForm(addressList.items.length === 0);
        if (!storeSettings["payment.razorpayEnabled"]) setMethod("COD");
      } catch {
        setError("Could not load checkout details.");
      } finally {
        setReady(true);
      }
    })();
  }, [status, router]);

  const saveAddress = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const created = await api.post<Address>("/addresses", {
        label: form.get("label") || "Home",
        fullName: form.get("fullName"),
        phone: form.get("phone"),
        line1: form.get("line1"),
        line2: form.get("line2") || undefined,
        city: form.get("city"),
        state: form.get("state"),
        pincode: form.get("pincode"),
        isDefault: addresses.length === 0,
      });
      setAddresses((prev) => [...prev, created]);
      setAddressId(created.id);
      setShowForm(false);
      toast.success("Address saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save address");
    }
  };

  const loadRazorpay = () =>
    new Promise<boolean>((resolve) => {
      if (window.Razorpay) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });

  const finish = (order: Order) => {
    clear();
    router.push(`/order-confirmation/${order.id}`);
  };

  const payWithRazorpay = async (order: Order) => {
    setStage("Opening secure payment…");
    const intent = await api.post<{
      devMode: boolean;
      keyId: string | null;
      razorpayOrderId: string | null;
      orderId: string;
      orderNumber: string;
      amount: number;
      currency: string;
      amountDisplay: string;
    }>("/payments/create-order", { orderId: order.id });

    if (intent.devMode) {
      setStage("Confirming test payment…");
      const confirmed = await api.post<Order>("/payments/dev-complete", { orderId: order.id });
      toast.success("Payment confirmed (test mode)");
      finish(confirmed);
      return;
    }

    const loaded = await loadRazorpay();
    if (!loaded || !window.Razorpay || !intent.razorpayOrderId) {
      throw new ApiError("Payment window could not be loaded. Please try again.", 0, "PAYMENT_UNAVAILABLE");
    }

    await new Promise<void>((resolve, reject) => {
      const checkout = new window.Razorpay!({
        key: intent.keyId,
        amount: intent.amount,
        currency: intent.currency,
        name: "CuddleHug",
        description: `Order ${intent.orderNumber ?? order.orderNumber}`,
        order_id: intent.razorpayOrderId,
        prefill: {
          name: user ? `${user.firstName} ${user.lastName}` : "",
          email: user?.email ?? "",
          contact: user?.phone ?? "",
        },
        theme: { color: "#e0674f" },
        modal: { ondismiss: () => reject(new ApiError("Payment cancelled", 400, "PAYMENT_CANCELLED")) },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            setStage("Verifying payment…");
            const verified = await api.post<Order>("/payments/verify", response);
            resolve();
            finish(verified);
          } catch (err) {
            reject(err);
          }
        },
      });
      checkout.open();
    });
  };

  const placeOrder = async () => {
    if (!addressId) {
      toast.error("Please choose a delivery address");
      return;
    }
    setPlacing(true);
    setError(null);
    try {
      setStage("Placing your order…");
      const order = await api.post<Order>("/orders", {
        addressId,
        paymentMethod: method,
        couponCode: cart.coupon?.code ?? undefined,
      });
      if (method === "COD") {
        finish(order);
        return;
      }
      await payWithRazorpay(order);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not place the order";
      setError(message);
      toast.error(message);
    } finally {
      setPlacing(false);
      setStage("");
    }
  };

  if (status === "loading" || !ready) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Skeleton className="mb-6 h-8 w-56" />
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-52 w-full" />
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  if (cartLoading || cart.items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icon="cart"
            title="Nothing to check out"
            description="Your bag is empty — add a teddy first."
            action={
              <Link href="/shop">
                <Button>Back to shop</Button>
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const codAvailable = settings?.["shipping.codEnabled"] ?? true;
  const onlineEnabled = settings?.["payment.razorpayEnabled"] ?? false;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-2xl font-bold">Checkout</h1>
        <span className="text-sm text-muted-foreground">{cart.items.length} item(s)</span>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Address */}
          <section className="rounded-lg border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold">1. Delivery address</h2>
              {!showForm && (
                <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4" /> New address
                </Button>
              )}
            </div>

            {addresses.length > 0 && !showForm && (
              <div className="space-y-2">
                {addresses.map((address) => (
                  <label
                    key={address.id}
                    className={`flex cursor-pointer gap-3 rounded-md border p-3 transition ${
                      addressId === address.id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
                    }`}
                  >
                    <input
                      type="radio"
                      name="address"
                      checked={addressId === address.id}
                      onChange={() => setAddressId(address.id)}
                      className="mt-1 accent-[var(--color-primary)]"
                    />
                    <span className="text-sm">
                      <span className="font-semibold">{address.fullName}</span>
                      <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                        {address.label}
                      </span>
                      <br />
                      <span className="text-muted-foreground">
                        {address.line1}
                        {address.line2 ? `, ${address.line2}` : ""}, {address.city}, {address.state} {address.pincode}
                      </span>
                      <br />
                      <span className="text-muted-foreground">{address.phone}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}

            {showForm && (
              <form onSubmit={saveAddress} className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" required>
                  <Input name="fullName" required minLength={2} defaultValue={user ? `${user.firstName} ${user.lastName}` : ""} />
                </Field>
                <Field label="Phone" required>
                  <Input name="phone" required placeholder="+91 98765 43210" />
                </Field>
                <Field label="Address line 1" required className="sm:col-span-2">
                  <Input name="line1" required placeholder="Flat, house no., street" />
                </Field>
                <Field label="Address line 2" className="sm:col-span-2">
                  <Input name="line2" placeholder="Landmark (optional)" />
                </Field>
                <Field label="City" required>
                  <Input name="city" required />
                </Field>
                <Field label="State" required>
                  <Input name="state" required />
                </Field>
                <Field label="Pincode" required>
                  <Input name="pincode" required inputMode="numeric" pattern="[0-9]{6}" maxLength={6} />
                </Field>
                <Field label="Label">
                  <Input name="label" placeholder="Home / Work" />
                </Field>
                <div className="flex gap-3 sm:col-span-2">
                  <Button type="submit">Save address</Button>
                  {addresses.length > 0 && (
                    <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            )}
          </section>

          {/* Payment */}
          <section className="rounded-lg border border-border bg-card p-5">
            <h2 className="mb-4 text-base font-bold">2. Payment method</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {onlineEnabled && (
                <PaymentOption
                  active={method === "RAZORPAY"}
                  onSelect={() => setMethod("RAZORPAY")}
                  icon={<CreditCard className="h-5 w-5" />}
                  title="Pay online"
                  subtitle="UPI, cards, netbanking · Razorpay"
                />
              )}
              {codAvailable && (
                <PaymentOption
                  active={method === "COD"}
                  onSelect={() => setMethod("COD")}
                  icon={<Banknote className="h-5 w-5" />}
                  title="Cash on delivery"
                  subtitle="Pay when your bear arrives"
                />
              )}
              {!onlineEnabled && !codAvailable && (
                <p className="text-sm text-muted-foreground">No payment methods are available right now.</p>
              )}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-success" />
              Payments are processed over an encrypted connection. We never store card details.
            </p>
          </section>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-24 lg:h-fit">
          <div className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-base font-bold">Order summary</h2>
            <ul className="mt-4 space-y-3">
              {cart.items.map((item) => (
                <li key={item.id} className="flex gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.imageUrl ?? "/images/08_product_brown_teddy.jpg"}
                    alt=""
                    className="h-14 w-14 rounded-md object-cover"
                  />
                  <div className="flex-1 text-sm">
                    <p className="line-clamp-1 font-medium">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.variantLabel} · qty {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{formatMoney(item.lineTotal)}</p>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd>{formatMoney(cart.summary.subtotal)}</dd>
              </div>
              {Number(cart.summary.couponDiscount) > 0 && (
                <div className="flex justify-between text-success">
                  <dt>Coupon</dt>
                  <dd>-{formatMoney(cart.summary.couponDiscount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Shipping</dt>
                <dd>{Number(cart.summary.shipping) === 0 ? "FREE" : formatMoney(cart.summary.shipping)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tax</dt>
                <dd>{formatMoney(cart.summary.tax)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-3 text-base font-bold">
                <dt>Total</dt>
                <dd>{formatMoney(cart.summary.total)}</dd>
              </div>
            </dl>

            <Button size="lg" className="mt-4 w-full" onClick={placeOrder} loading={placing}>
              {placing ? stage || "Placing order…" : `Pay ${formatMoney(cart.summary.total)}`}
            </Button>

            <p className="mt-3 text-center text-xs text-muted-foreground">
              By placing an order you agree to our terms &amp; privacy policy.
            </p>
          </div>
        </aside>
      </div>

      {placing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 backdrop-blur-sm">
          <div className="flex items-center gap-3 rounded-lg bg-card px-6 py-4 shadow-lift">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm font-medium">{stage || "Working…"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function PaymentOption({
  active,
  onSelect,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onSelect: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-start gap-3 rounded-md border p-4 text-left transition ${
        active ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground"
      }`}
    >
      <span className={active ? "text-primary" : "text-muted-foreground"}>{icon}</span>
      <span>
        <span className="flex items-center gap-2 text-sm font-semibold">
          {title}
          {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
        </span>
        <span className="text-xs text-muted-foreground">{subtitle}</span>
      </span>
    </button>
  );
}
