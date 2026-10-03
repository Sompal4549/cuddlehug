"use client";

import * as React from "react";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { Address } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty";

const emptyForm = {
  label: "Home",
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
};

export default function AddressesPage() {
  const [addresses, setAddresses] = React.useState<Address[] | null>(null);
  const [form, setForm] = React.useState(emptyForm);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    api
      .get<{ items: Address[] }>("/addresses")
      .then((data) => setAddresses(data.items))
      .catch(() => setAddresses([]));
  }, []);

  React.useEffect(load, [load]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      if (editingId) {
        await api.patch(`/addresses/${editingId}`, form);
        toast.success("Address updated");
      } else {
        await api.post("/addresses", { ...form, line2: form.line2 || undefined });
        toast.success("Address added");
      }
      setOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save address");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/addresses/${id}`);
      setAddresses((prev) => (prev ?? []).filter((address) => address.id !== id));
      toast.success("Address removed");
    } catch {
      toast.error("Could not remove address");
    }
  };

  const makeDefault = async (id: string) => {
    try {
      await api.post(`/addresses/${id}/default`);
      load();
      toast.success("Default address updated");
    } catch {
      toast.error("Could not set default");
    }
  };

  const startEdit = (address: Address) => {
    setEditingId(address.id);
    setForm({
      label: address.label,
      fullName: address.fullName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2 ?? "",
      city: address.city,
      state: address.state,
      pincode: address.pincode,
    });
    setOpen(true);
  };

  if (addresses === null) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Saved addresses</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditingId(null);
            setForm(emptyForm);
            setOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Add address
        </Button>
      </div>

      {addresses.length === 0 && !open && (
        <div className="rounded-lg border border-border bg-card">
          <EmptyState
            icon="cart"
            title="No saved addresses"
            description="Add one now to check out faster next time."
            action={<Button onClick={() => setOpen(true)}>Add address</Button>}
          />
        </div>
      )}

      <ul className="space-y-3">
        {addresses.map((address) => (
          <li key={address.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                <div className="text-sm">
                  <p className="font-semibold">
                    {address.fullName}
                    <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                      {address.label}
                    </span>
                    {address.isDefault && (
                      <span className="ml-2 rounded bg-success/12 px-1.5 py-0.5 text-[10px] uppercase text-success">
                        Default
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {address.line1}
                    {address.line2 ? `, ${address.line2}` : ""}, {address.city}, {address.state} {address.pincode}
                  </p>
                  <p className="text-muted-foreground">{address.phone}</p>
                </div>
              </div>
              <div className="flex gap-1">
                {!address.isDefault && (
                  <Button variant="ghost" size="sm" onClick={() => void makeDefault(address.id)}>
                    Set default
                  </Button>
                )}
                <button
                  type="button"
                  aria-label="Edit address"
                  onClick={() => startEdit(address)}
                  className="rounded p-1.5 text-muted-foreground hover:bg-muted"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Delete address"
                  onClick={() => void remove(address.id)}
                  className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {open && (
        <form onSubmit={submit} className="rounded-lg border border-border bg-card p-5">
          <h3 className="mb-4 font-semibold">{editingId ? "Edit address" : "New address"}</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" required>
              <Input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </Field>
            <Field label="Phone" required>
              <Input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Address line 1" required className="sm:col-span-2">
              <Input required value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} />
            </Field>
            <Field label="Address line 2" className="sm:col-span-2">
              <Input value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} />
            </Field>
            <Field label="City" required>
              <Input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </Field>
            <Field label="State" required>
              <Input required value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
            </Field>
            <Field label="Pincode" required>
              <Input
                required
                pattern="[0-9]{6}"
                maxLength={6}
                value={form.pincode}
                onChange={(e) => setForm({ ...form, pincode: e.target.value })}
              />
            </Field>
            <Field label="Label">
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </Field>
          </div>
          <div className="mt-4 flex gap-3">
            <Button type="submit" loading={busy}>
              Save address
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
