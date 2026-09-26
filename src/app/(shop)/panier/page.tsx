"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/components/cart";
import { formatEUR } from "@/lib/pricing";
import type { RelayPoint } from "@/lib/types";

const MR_BRAND = process.env.NEXT_PUBLIC_MONDIAL_RELAY_BRAND;
// BDTEST est le code de démo public Mondial Relay : tant qu'un vrai code enseigne
// n'est pas configuré (compte pro), on demande l'adresse et un admin assigne le
// point relais le plus proche à la main (voir /admin/commandes).
const WIDGET_ENABLED = Boolean(MR_BRAND) && MR_BRAND !== "BDTEST";

type MRParcelShopData = {
  ID: string;
  Nom: string;
  Adresse1: string;
  Adresse2?: string;
  CP: string;
  Ville: string;
  Pays: string;
};

declare global {
  interface Window {
    jQuery?: {
      (selector: string): {
        MR_ParcelShopPicker: (options: Record<string, unknown>) => void;
      };
    };
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Échec de chargement : ${src}`));
    document.body.appendChild(s);
  });
}

export default function CartPage() {
  const { lines, subtotal, ready, setQuantity, remove } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"relais" | "domicile">("relais");
  const [relayPoint, setRelayPoint] = useState<RelayPoint | null>(null);
  const [shipping, setShipping] = useState<number | null>(null);

  const items = useMemo(() => lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })), [lines]);

  useEffect(() => {
    if (mode !== "relais" || !WIDGET_ENABLED || !MR_BRAND) return;
    let cancelled = false;
    (async () => {
      try {
        await loadScript("https://code.jquery.com/jquery-3.7.1.min.js");
        await loadScript("https://unpkg.com/leaflet@1.9.4/dist/leaflet.js");
        await loadScript("https://widget.mondialrelay.com/parcelshop-picker/jquery.plugin.mondialrelay.parcelshoppicker.min.js");
        if (cancelled) return;
        window.jQuery?.("#mr-widget").MR_ParcelShopPicker({
          Target: "#mr-relay-id",
          Country: "FR",
          Brand: MR_BRAND.padEnd(8, " "),
          ShowResultsOnMap: true,
          DisplayMapInfo: true,
          OnParcelShopSelected: (data: MRParcelShopData) => {
            setRelayPoint({
              id: data.ID,
              name: data.Nom,
              address1: data.Adresse1,
              address2: data.Adresse2 || undefined,
              postcode: data.CP,
              city: data.Ville,
              country: data.Pays,
            });
          },
        });
      } catch {
        if (!cancelled) setError("Le sélecteur de point relais n'a pas pu se charger.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  useEffect(() => {
    if (!items.length) {
      setShipping(0);
      return;
    }
    const country = mode === "relais" ? relayPoint?.country ?? null : "FR";
    if (!country) {
      setShipping(null);
      return;
    }
    const controller = new AbortController();
    fetch("/api/shipping-quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, country }),
      signal: controller.signal,
    })
      .then((r) => r.json())
      .then((d) => setShipping(typeof d.shipping === "number" ? d.shipping : null))
      .catch(() => {});
    return () => controller.abort();
  }, [items, mode, relayPoint]);

  async function checkout() {
    if (mode === "relais" && WIDGET_ENABLED && !relayPoint) {
      setError("Choisissez un point relais avant de payer.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          deliveryMode: mode,
          relayPoint: mode === "relais" ? relayPoint : null,
        }),
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

      <section className="mt-8 space-y-4 rounded-xl bg-sheet p-5">
        <h2 className="font-semibold">Mode de livraison</h2>
        <div className="flex gap-6 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" checked={mode === "relais"} onChange={() => setMode("relais")} />
            Point relais
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="mode" checked={mode === "domicile"} onChange={() => setMode("domicile")} />
            À domicile
          </label>
        </div>

        {mode === "relais" &&
          (WIDGET_ENABLED ? (
            <div>
              <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
              <div id="mr-widget" />
              <input type="hidden" id="mr-relay-id" />
              {relayPoint && (
                <p className="mt-2 rounded-lg bg-ok/10 p-3 text-sm text-ok">
                  Point sélectionné : {relayPoint.name}, {relayPoint.address1}, {relayPoint.postcode} {relayPoint.city}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">
              Indiquez votre adresse à l&apos;étape de paiement : nous choisissons le point relais le plus proche
              de chez vous et vous l&apos;envoyons par e-mail dès la validation de votre commande.
            </p>
          ))}
        {mode === "domicile" && (
          <p className="text-sm text-muted">Le montant exact est confirmé à l&apos;étape de paiement selon votre adresse.</p>
        )}
      </section>

      <div className="mt-6 flex flex-col items-end gap-1">
        <p className="tabular text-sm text-muted">
          Sous-total <span className="ml-2 font-medium text-ink">{formatEUR(subtotal)}</span>
        </p>
        <p className="tabular text-sm text-muted">
          Livraison <span className="ml-2 font-medium text-ink">{shipping == null ? "…" : formatEUR(shipping)}</span>
        </p>
        <p className="tabular text-lg">
          Total <span className="ml-3 font-semibold">{formatEUR(subtotal + (shipping ?? 0))}</span>
        </p>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button className="btn mt-2" onClick={checkout} disabled={loading}>
          {loading ? "Redirection vers le paiement…" : "Payer la commande"}
        </button>
      </div>
    </div>
  );
}
