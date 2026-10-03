"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordCheck, passwordIssues } from "@/components/auth/password-check";

function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register } = useSession();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const next = searchParams.get("next") || "/account";

  const issues = passwordIssues(password);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    if (issues.length > 0) {
      setError(`Password still needs: ${issues.join(", ").toLowerCase()}.`);
      setBusy(false);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      setBusy(false);
      return;
    }
    try {
      const user = await register({
        firstName: String(form.get("firstName")),
        lastName: String(form.get("lastName")),
        email: String(form.get("email")),
        password,
        phone: String(form.get("phone") || "") || undefined,
      });
      toast.success(`Welcome to CuddleHug, ${user.firstName}!`);
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="One account for orders, wishlists and faster checkout."
      footer={
        <>
          Already hugging?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name" required>
            <Input name="firstName" required minLength={2} autoComplete="given-name" />
          </Field>
          <Field label="Last name" required>
            <Input name="lastName" required autoComplete="family-name" />
          </Field>
        </div>
        <Field label="Email" required>
          <Input name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
        </Field>
        <Field label="Phone (optional)">
          <Input name="phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210" />
        </Field>
        <Field label="Password" required>
          <Input
            name="password"
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <PasswordCheck value={password} className="mt-1" />
        </Field>
        <Field label="Confirm password" required error={confirm && confirm !== password ? "Passwords do not match" : null}>
          <Input
            name="confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </Field>
        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Create account
        </Button>
        <p className="text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link href="/terms" className="text-primary hover:underline">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-primary hover:underline">
            privacy policy
          </Link>
          .
        </p>
      </form>
    </AuthShell>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-16" /> }>
      <RegisterPage />
    </Suspense>
  );
}
