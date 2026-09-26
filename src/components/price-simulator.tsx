"use client";

import { useState } from "react";
import { computePrice, formatEUR } from "@/lib/pricing";
import type { Material, PricingSettings } from "@/lib/types";

export function PriceSimulator({ settings, materials }: { settings: PricingSettings; materials: Material[] }) {
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? "");
  const [grams, setGrams] = useState("45");
  const [hours, setHours] = useState("2");
  const [minutes, setMinutes] = useState("30");
  const [labor, setLabor] = useState("10");

  const material = materials.find((m) => m.id === materialId);
  const n = (s: string) => Math.max(0, Number(s.replace(",", ".")) || 0);
  const b = material
    ? computePrice(
        { grams: n(grams), print_minutes: n(hours) * 60 + n(minutes), labor_minutes: n(labor) },
        material,
        settings,
      )
    : null;

  const rows = b
    ? [
        ["Matière", b.material],
        ["Machine", b.machine],
        ["Provision échecs", b.failureAllowance],
        ["Finition", b.labor],
        ["Emballage", b.packaging],
      ]
    : [];

  return (
    <section className="rounded-xl bg-sheet p-5">
      <h2 className="font-semibold">Simulateur de prix</h2>
      <p className="mt-1 text-sm text-muted">Reprenez le poids et la durée indiqués par votre slicer.</p>

      <div className="mt-5 grid gap-8 md:grid-cols-2">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label" htmlFor="sim-mat">Matière</label>
            <select id="sim-mat" value={materialId} onChange={(e) => setMaterialId(e.target.value)} className="field">
              {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({formatEUR(m.price_per_kg)}/kg)</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="label" htmlFor="sim-g">Filament (g)</label>
            <input id="sim-g" value={grams} onChange={(e) => setGrams(e.target.value)} inputMode="decimal" className="field tabular" />
          </div>
          <div>
            <label className="label" htmlFor="sim-h">Impression (h)</label>
            <input id="sim-h" value={hours} onChange={(e) => setHours(e.target.value)} inputMode="numeric" className="field tabular" />
          </div>
          <div>
            <label className="label" htmlFor="sim-m">et (min)</label>
            <input id="sim-m" value={minutes} onChange={(e) => setMinutes(e.target.value)} inputMode="numeric" className="field tabular" />
          </div>
          <div className="col-span-2">
            <label className="label" htmlFor="sim-l">Finition (min)</label>
            <input id="sim-l" value={labor} onChange={(e) => setLabor(e.target.value)} inputMode="numeric" className="field tabular" />
          </div>
        </div>

        {b && (
          <div aria-live="polite">
            <table className="tabular w-full text-sm">
              <tbody>
                {rows.map(([label, v]) => (
                  <tr key={label as string} className="border-b border-line">
                    <td className="py-2 text-muted">{label}</td>
                    <td className="py-2 text-right">{formatEUR(v as number)}</td>
                  </tr>
                ))}
                <tr className="border-b border-line font-medium">
                  <td className="py-2">Coût de revient</td>
                  <td className="py-2 text-right">{formatEUR(b.cost)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-muted">Prix HT (× {settings.margin_multiplier})</td>
                  <td className="py-2 text-right">{formatEUR(b.priceExVat)}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-4 flex items-baseline justify-between">
              <span>Prix de vente</span>
              <span className="tabular font-[family-name:var(--font-display)] text-4xl font-bold text-filament">{formatEUR(b.price)}</span>
            </p>
            <p className="tabular mt-1 text-right text-sm text-muted">
              Marge nette {formatEUR(b.price / (1 + Number(settings.vat_rate)) - b.cost)} par pièce
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
