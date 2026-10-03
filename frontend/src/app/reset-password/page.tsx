"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { AuthShell } from "@/components/auth/auth-shell";
import { PasswordCheck, passwordIssues } from "@/components/auth/password-check";

function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const token = searchParams.get("token") ?? "";
  const issues = passwordIssues(password);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
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
      await api.post("/auth/reset-password", { token, password }, { noRetry: true });
      toast.success("Password updated — sign in with your new password");
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <AuthShell title="Invalid reset link" subtitle="This link is missing or malformed.">
        <Link href="/forgot-password">
          <Button>Request a new link</Button>
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Make it something you will want to hug often.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password" required>
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
        <Button type="submit" className="w-full" loading={busy}>
          Update password
        </Button>
      </form>
    </AuthShell>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-16" /> }>
      <ResetPasswordPage />
    </Suspense>
  );
}
