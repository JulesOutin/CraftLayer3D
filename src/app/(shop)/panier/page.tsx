"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart";
import { formatEUR } from "@/lib/pricing";

export default function CartPage() {
  const { lines, subtotal, ready, setQuantity, remove } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })) }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Le paiement n'a pas pu démarrer.");
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Le paiement n'a pas pu démarrer.");
      setLoading(false);
    }
  }

  if (!ready) return null;

  if (lines.length === 0) {
    return (
      <div className="py-20 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Votre panier est vide</h1>
        <Link href="/" className="btn mt-6">Voir le catalogue</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl pt-4">
      <h1 className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight">Panier</h1>

      <ul className="mt-8 divide-y divide-line border-y border-line">
        {lines.map((l) => (
          <li key={l.variantId} className="flex items-center gap-4 py-4">
            <div className="layers h-20 w-20 shrink-0 overflow-hidden rounded-xl">
              {l.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={l.imageUrl} alt="" className="h-full w-full object-contain p-2" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/produits/${l.slug}`} className="font-medium hover:underline">{l.productTitle}</Link>
              <p className="text-sm text-muted">{l.variantName}</p>
              <button onClick={() => remove(l.variantId)} className="mt-1 text-sm text-muted underline hover:text-danger">
                Retirer
              </button>
            </div>
            <label className="sr-only" htmlFor={`q-${l.variantId}`}>Quantité</label>
            <input
              id={`q-${l.variantId}`}
              type="number"
              min={0}
              max={20}
              value={l.quantity}
              onChange={(e) => setQuantity(l.variantId, Number(e.target.value) || 0)}
              className="field tabular w-16"
            />
            <p className="tabular w-24 text-right font-medium">{formatEUR(l.price * l.quantity)}</p>
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-col items-end gap-2">
        <p className="tabular text-lg">
          Sous-total <span className="ml-3 font-semibold">{formatEUR(subtotal)}</span>
        </p>
        <p className="text-sm text-muted">Frais de livraison calculés à l&apos;étape suivante.</p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button className="btn mt-2" onClick={checkout} disabled={loading}>
          {loading ? "Redirection vers le paiement…" : "Payer la commande"}
        </button>
      </div>
    </div>
  );
}
