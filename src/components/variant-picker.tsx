"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "./cart";
import { formatDuration, formatEUR } from "@/lib/pricing";

type V = {
  id: string;
  name: string;
  price: number;
  material: string;
  grams: number;
  print_minutes: number;
  stock: number | null;
};
type P = { id: string; slug: string; title: string; image_url: string | null };

const isOutOfStock = (v: V) => v.stock !== null && v.stock <= 0;

export function VariantPicker({ product, variants }: { product: P; variants: V[] }) {
  const { add } = useCart();
  const [selected, setSelected] = useState(variants.find((x) => !isOutOfStock(x))?.id ?? variants[0].id);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const v = variants.find((x) => x.id === selected)!;
  const outOfStock = isOutOfStock(v);
  const maxQty = v.stock !== null ? Math.max(0, Math.min(20, v.stock)) : 20;

  return (
    <div className="mt-8">
      <p className="tabular font-[family-name:var(--font-display)] text-3xl font-bold">{formatEUR(v.price)}</p>

      {variants.length > 1 && (
        <fieldset className="mt-5">
          <legend className="label">Déclinaison</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((x) => (
              <label
                key={x.id}
                className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition-colors ${
                  x.id === selected ? "border-filament bg-filament text-white" : "border-line bg-sheet hover:border-ink"
                } ${isOutOfStock(x) ? "opacity-50" : ""}`}
              >
                <input
                  type="radio"
                  name="variant"
                  value={x.id}
                  checked={x.id === selected}
                  onChange={() => {
                    setSelected(x.id);
                    setQty(1);
                    setAdded(false);
                  }}
                  className="sr-only"
                />
                {x.name}
                {isOutOfStock(x) && " (épuisé)"}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <dl className="tabular mt-5 grid grid-cols-3 gap-3 rounded-xl border border-line p-4 text-sm">
        <div>
          <dt className="text-muted">Matière</dt>
          <dd className="font-medium">{v.material}</dd>
        </div>
        <div>
          <dt className="text-muted">Poids</dt>
          <dd className="font-medium">{v.grams} g</dd>
        </div>
        <div>
          <dt className="text-muted">Impression</dt>
          <dd className="font-medium">{formatDuration(v.print_minutes)}</dd>
        </div>
      </dl>

      {outOfStock ? (
        <p role="status" className="mt-6 text-sm text-danger">Rupture de stock pour cette déclinaison.</p>
      ) : (
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="qty">Quantité</label>
        <input
          id="qty"
          type="number"
          min={1}
          max={maxQty}
          value={qty}
          onChange={(e) => setQty(Math.max(1, Math.min(maxQty, Number(e.target.value) || 1)))}
          className="field tabular w-20"
        />
        <button
          className="btn"
          onClick={() => {
            add(
              {
                variantId: v.id,
                productTitle: product.title,
                variantName: v.name,
                slug: product.slug,
                imageUrl: product.image_url,
                price: v.price,
              },
              qty,
            );
            setAdded(true);
          }}
        >
          Ajouter au panier
        </button>
        {added && (
          <p role="status" className="text-sm">
            Ajouté. <Link href="/panier" className="font-medium text-filament underline">Voir le panier</Link>
          </p>
        )}
      </div>
      )}
      {!outOfStock && v.stock !== null && v.stock <= 5 && (
        <p className="mt-2 text-sm text-muted">Plus que {v.stock} en stock.</p>
      )}
    </div>
  );
}
