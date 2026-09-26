"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartLine = {
  variantId: string;
  productTitle: string;
  variantName: string;
  slug: string;
  imageUrl: string | null;
  price: number; // indicatif : le serveur recalcule au paiement
  quantity: number;
};

type CartCtx = {
  lines: CartLine[];
  count: number;
  subtotal: number;
  ready: boolean;
  add: (line: Omit<CartLine, "quantity">, qty?: number) => void;
  setQuantity: (variantId: string, qty: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
};

const Ctx = createContext<CartCtx | null>(null);
const KEY = "panier-v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {
      /* panier illisible : on repart de zéro */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(lines));
    } catch {
      /* stockage indisponible */
    }
  }, [lines, ready]);

  const add = useCallback((line: Omit<CartLine, "quantity">, qty = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.variantId === line.variantId);
      if (existing) {
        return prev.map((l) =>
          l.variantId === line.variantId ? { ...l, ...line, quantity: Math.min(l.quantity + qty, 20) } : l,
        );
      }
      return [...prev, { ...line, quantity: qty }];
    });
  }, []);

  const setQuantity = useCallback((variantId: string, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((l) => l.variantId !== variantId)
        : prev.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(qty, 20) } : l)),
    );
  }, []);

  const remove = useCallback((variantId: string) => {
    setLines((prev) => prev.filter((l) => l.variantId !== variantId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartCtx>(
    () => ({
      lines,
      ready,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      subtotal: lines.reduce((n, l) => n + l.price * l.quantity, 0),
      add,
      setQuantity,
      remove,
      clear,
    }),
    [lines, ready, add, setQuantity, remove, clear],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart doit être utilisé dans <CartProvider>");
  return ctx;
}
