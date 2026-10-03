"use client";

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const PASSWORD_RULES = [
  { test: (value: string) => value.length >= 8, label: "At least 8 characters" },
  { test: (value: string) => /[A-Za-z]/.test(value), label: "One letter" },
  { test: (value: string) => /[0-9]/.test(value), label: "One number" },
] as const;

export function passwordIssues(value: string): string[] {
  return PASSWORD_RULES.filter((rule) => !rule.test(value)).map((rule) => rule.label);
}

/** Live checklist that mirrors the backend password policy. */
export function PasswordCheck({ value, className }: { value: string; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1 text-xs", className)}>
      {PASSWORD_RULES.map((rule) => {
        const ok = rule.test(value);
        return (
          <li
            key={rule.label}
            className={cn("inline-flex items-center gap-1", ok ? "text-success" : "text-muted-foreground")}
          >
            {ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
            {rule.label}
          </li>
        );
      })}
    </ul>
  );
}
