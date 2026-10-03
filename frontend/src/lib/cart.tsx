"use client";

import * as React from "react";
import { api, errorMessage } from "@/lib/api";
import type { Cart } from "@/lib/types";
import { useSession } from "@/lib/session";

type CartContextValue = {
  cart: Cart;
  loading: boolean;
  count: number;
  addItem: (variantId: string, quantity?: number) => Promise<void>;
  updateItem: (variantId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clear: () => void;
  applyCoupon: (code: string) => Promise<void>;
  removeCoupon: () => Promise<void>;
  reload: () => Promise<void>;
  error: string | null;
};

const emptyCart: Cart = {
  id: "",
  items: [],
  summary: {
    subtotal: "0.00",
    mrpTotal: "0.00",
    productSavings: "0.00",
    couponDiscount: "0.00",
    discountedSubtotal: "0.00",
    shipping: "0.00",
    tax: "0.00",
    total: "0.00",
    freeShippingUnlocked: false,
  },
  coupon: null,
};

const CartContext = React.createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { status, user } = useSession();
  const [cart, setCart] = React.useState<Cart>(emptyCart);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    try {
      const data = await api.get<Cart>("/cart");
      setCart(data);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (status === "loading") return;
    void reload();
  }, [status, user?.id, reload]);

  const run = React.useCallback(
    async (action: () => Promise<Cart>) => {
      try {
        const next = await action();
        setCart(next);
        setError(null);
      } catch (err) {
        setError(errorMessage(err));
        throw err;
      }
    },
    [],
  );

  const value = React.useMemo<CartContextValue>(
    () => ({
      cart,
      loading,
      count: cart.items.reduce((total, item) => total + item.quantity, 0),
      error,
      addItem: async (variantId, quantity = 1) => run(() => api.post<Cart>("/cart/items", { variantId, quantity })),
      updateItem: async (variantId, quantity) => run(() => api.patch<Cart>("/cart/items", { variantId, quantity })),
      removeItem: async (itemId) => run(() => api.delete<Cart>(`/cart/items/${itemId}`)),
      clear: () => setCart(emptyCart),
      applyCoupon: async (code) => run(() => api.post<Cart>("/cart/coupon", { code })),
      removeCoupon: async () => run(() => api.delete<Cart>("/cart/coupon")),
      reload,
    }),
    [cart, loading, error, reload, run],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = React.useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
