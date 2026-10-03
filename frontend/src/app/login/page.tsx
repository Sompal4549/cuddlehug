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

function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, status } = useSession();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const next = searchParams.get("next") || "/account";

  React.useEffect(() => {
    if (status === "authenticated") router.replace(next);
  }, [status, next, router]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const user = await login(String(form.get("email")), String(form.get("password")));
      toast.success(`Welcome back, ${user.firstName}!`);
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to see your orders, wishlist and saved addresses."
      footer={
        <>
          New to CuddleHug?{" "}
          <Link href={`/register?next=${encodeURIComponent(next)}`} className="font-semibold text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email" required>
          <Input name="email" type="email" required autoComplete="email" placeholder="you@example.com" />
        </Field>
        <Field label="Password" required>
          <Input name="password" type="password" required autoComplete="current-password" placeholder="••••••••" />
        </Field>
        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
        <div className="flex items-center justify-between">
          <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Forgot password?
          </Link>
          <Button type="submit" loading={busy}>
            Sign in
          </Button>
        </div>
      </form>
    </AuthShell>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-16" /> }>
      <LoginPage />
    </Suspense>
  );
}
