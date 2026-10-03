"use client";

import * as React from "react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type { StoreSettings } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input, Field, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel } from "@/components/admin/panels";

export default function AdminSettingsPage() {
  const [settings, setSettings] = React.useState<StoreSettings | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    api
      .get<StoreSettings>("/admin/settings")
      .then(setSettings)
      .catch((err: unknown) => setError(errorMessage(err)));
  }, []);

  const patch = (next: Partial<StoreSettings>) => setSettings((prev) => (prev ? { ...prev, ...next } : prev));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!settings) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await api.put<StoreSettings>("/admin/settings", {
        ...settings,
        "tax.enabled": Boolean(settings["tax.enabled"]),
        "tax.rate": Number(settings["tax.rate"]),
        "shipping.fee": Number(settings["shipping.fee"]),
        "shipping.freeThreshold": Number(settings["shipping.freeThreshold"]),
        "shipping.codEnabled": Boolean(settings["shipping.codEnabled"]),
        "payment.razorpayEnabled": Boolean(settings["payment.razorpayEnabled"]),
      });
      setSettings(updated);
      toast.success("Settings saved");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (error) return <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>;
  if (!settings) return <Skeleton className="h-96 w-full" />;

  const toggle = (key: "tax.enabled" | "shipping.codEnabled" | "payment.razorpayEnabled", label: string) => (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium">
      <input
        type="checkbox"
        checked={Boolean(settings[key])}
        onChange={(event) => patch({ [key]: event.target.checked } as Partial<StoreSettings>)}
        className="h-4 w-4 rounded border-input accent-[#e0674f]"
      />
      {label}
    </label>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Store settings</h1>
        <p className="text-sm text-muted-foreground">Shared across the storefront, cart and checkout.</p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        {error && <p className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}

        <Panel title="General">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Store name" required>
              <Input
                required
                value={settings["store.name"]}
                onChange={(event) => patch({ "store.name": event.target.value })}
              />
            </Field>
            <Field label="Tagline">
              <Input value={settings["store.tagline"]} onChange={(event) => patch({ "store.tagline": event.target.value })} />
            </Field>
            <Field label="Store status">
              <Select
                value={settings["store.status"]}
                onChange={(event) => patch({ "store.status": event.target.value as "open" | "closed" })}
                options={[
                  { value: "open", label: "Open" },
                  { value: "closed", label: "Closed (accept no new orders)" },
                ]}
              />
            </Field>
            <Field label="Currency">
              <Input value={settings["store.currency"]} onChange={(event) => patch({ "store.currency": event.target.value })} />
            </Field>
          </div>
        </Panel>

        <Panel title="Tax, shipping & payments">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="GST rate (%)">
              <Input
                inputMode="decimal"
                value={String(settings["tax.rate"])}
                onChange={(event) => patch({ "tax.rate": Number(event.target.value) } as Partial<StoreSettings>)}
              />
            </Field>
            <Field label="Shipping fee (₹)">
              <Input
                inputMode="decimal"
                value={String(settings["shipping.fee"])}
                onChange={(event) => patch({ "shipping.fee": Number(event.target.value) } as Partial<StoreSettings>)}
              />
            </Field>
            <Field label="Free shipping above (₹)">
              <Input
                inputMode="decimal"
                value={String(settings["shipping.freeThreshold"])}
                onChange={(event) => patch({ "shipping.freeThreshold": Number(event.target.value) } as Partial<StoreSettings>)}
              />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-6">
            {toggle("tax.enabled", "Charge GST")}
            {toggle("shipping.codEnabled", "Cash on delivery")}
            {toggle("payment.razorpayEnabled", "Razorpay online payments")}
          </div>
        </Panel>

        <Panel title="Contact & socials">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Support email">
              <Input
                type="email"
                value={settings["contact.email"]}
                onChange={(event) => patch({ "contact.email": event.target.value })}
              />
            </Field>
            <Field label="Support phone">
              <Input value={settings["contact.phone"]} onChange={(event) => patch({ "contact.phone": event.target.value })} />
            </Field>
            <Field label="Studio address" className="sm:col-span-2">
              <Textarea
                rows={2}
                value={settings["contact.address"]}
                onChange={(event) => patch({ "contact.address": event.target.value })}
              />
            </Field>
            <Field label="Instagram URL">
              <Input value={settings["social.instagram"]} onChange={(event) => patch({ "social.instagram": event.target.value })} />
            </Field>
            <Field label="Facebook URL">
              <Input value={settings["social.facebook"]} onChange={(event) => patch({ "social.facebook": event.target.value })} />
            </Field>
            <Field label="X (Twitter) URL">
              <Input value={settings["social.twitter"]} onChange={(event) => patch({ "social.twitter": event.target.value })} />
            </Field>
            <Field label="YouTube URL">
              <Input value={settings["social.youtube"]} onChange={(event) => patch({ "social.youtube": event.target.value })} />
            </Field>
          </div>
        </Panel>

        <div className="flex gap-3">
          <Button type="submit" loading={busy}>
            Save settings
          </Button>
        </div>
      </form>
    </div>
  );
}
