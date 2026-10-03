"use client";

import * as React from "react";
import { Package, Wallet, Heart, Star } from "lucide-react";
import { api } from "@/lib/api";
import { useSession } from "@/lib/session";
import { formatMoney, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Stats = { totalOrders: number; totalSpend: string; pendingOrders: number; deliveredOrders: number };

export default function AccountPage() {
  const { user, updateProfile } = useSession();
  const [stats, setStats] = React.useState<Stats | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    api
      .get<Stats>("/orders/stats")
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    try {
      await updateProfile({
        firstName: String(form.get("firstName")),
        lastName: String(form.get("lastName")),
        phone: String(form.get("phone") || "") || null,
      });
      setMessage("Profile updated");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update profile");
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  const cards = [
    { icon: Package, label: "Orders placed", value: stats ? String(stats.totalOrders) : "—" },
    { icon: Wallet, label: "Total spent", value: stats ? formatMoney(stats.totalSpend) : "—" },
    { icon: Star, label: "In progress", value: stats ? String(stats.pendingOrders) : "—" },
    { icon: Heart, label: "Member since", value: formatDate(user.createdAt) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4">
              <card.icon className="h-4 w-4 text-primary" />
              <p className="mt-2 text-lg font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" required>
              <Input name="firstName" defaultValue={user.firstName} required minLength={2} />
            </Field>
            <Field label="Last name" required>
              <Input name="lastName" defaultValue={user.lastName} required />
            </Field>
            <Field label="Email">
              <Input value={user.email} disabled />
            </Field>
            <Field label="Phone">
              <Input name="phone" type="tel" defaultValue={user.phone ?? ""} placeholder="+91 98765 43210" />
            </Field>
            <div className="flex items-center gap-3 sm:col-span-2">
              <Button type="submit" loading={busy}>
                Save changes
              </Button>
              {message && <p className="text-sm font-medium text-success">{message}</p>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account status</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Role: <span className="font-medium text-foreground">{user.role}</span>
          </p>
          <p className="mt-1">
            Email verified:{" "}
            <span className="font-medium text-foreground">{user.emailVerified ? "Yes" : "Not yet"}</span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
