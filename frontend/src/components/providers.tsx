"use client";

import * as React from "react";
import { SessionProvider } from "@/lib/session";
import { CartProvider } from "@/lib/cart";
import { Toaster } from "@/components/ui/toaster";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CartProvider>
        {children}
        <Toaster />
      </CartProvider>
    </SessionProvider>
  );
}
