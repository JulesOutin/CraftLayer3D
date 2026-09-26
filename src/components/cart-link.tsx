"use client";

import Link from "next/link";
import { useCart } from "./cart";

export function CartLink() {
  const { count, ready } = useCart();
  return (
    <Link href="/panier" className="btn-ghost tabular">
      Panier
      {ready && count > 0 && (
        <span className="rounded-full bg-filament px-2 py-0.5 text-xs font-semibold text-white">{count}</span>
      )}
    </Link>
  );
}
