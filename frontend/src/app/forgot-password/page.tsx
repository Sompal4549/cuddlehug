"use client";

import * as React from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { AuthShell } from "@/components/auth/auth-shell";

export default function ForgotPasswordPage() {
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [devToken, setDevToken] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const email = String(new FormData(event.currentTarget).get("email"));
    try {
      const data = await api.post<{ message: string; devToken?: string }>("/auth/forgot-password", { email });
      setDone(true);
      setDevToken(data.devToken ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the reset link");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We will email you a secure link to set a new password."
      footer={
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      {done ? (
        <div className="space-y-4">
          <p className="rounded-md bg-success/10 px-4 py-3 text-sm text-success">
            If that email exists, a reset link is on its way. It expires in 30 minutes.
          </p>
          {devToken && (
            <div className="rounded-md border border-dashed border-warning/50 bg-warning/10 p-4 text-sm">
              <p className="font-semibold text-warning">Development mode</p>
              <p className="mt-1 text-muted-foreground">
                Emails are not sent locally. Use this link to continue:
              </p>
              <Link href={`/reset-password?token=${encodeURIComponent(devToken)}`} className="mt-2 inline-block break-all text-primary hover:underline">
                /reset-password?token={devToken}
              </Link>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email" required>
            <Input name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
          </Field>
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" loading={busy}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
