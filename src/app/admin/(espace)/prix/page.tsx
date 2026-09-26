import { requireAdmin } from "@/lib/auth";
import type { Material, PricingSettings } from "@/lib/types";
import { saveMaterial, saveSettings } from "../../actions";
import { PriceSimulator } from "@/components/price-simulator";

type Props = { searchParams: Promise<{ ok?: string; erreur?: string }> };

const FIELDS: { name: keyof PricingSettings; label: string; hint: string; percent?: boolean }[] = [
  { name: "machine_rate_per_hour", label: "Tarif machine (€/h)", hint: "Électricité, usure des buses et plateaux, amortissement" },
  { name: "labor_rate_per_hour", label: "Tarif main d'œuvre (€/h)", hint: "Appliqué aux minutes de finition" },
  { name: "failure_rate", label: "Taux d'échec (%)", hint: "Ajouté au coût matière et machine", percent: true },
  { name: "packaging_cost", label: "Emballage (€)", hint: "Par article" },
  { name: "margin_multiplier", label: "Coefficient de marge", hint: "Coût de revient × coefficient = prix HT" },
  { name: "vat_rate", label: "TVA (%)", hint: "0 en franchise en base de TVA", percent: true },
  { name: "rounding_step", label: "Arrondi (€)", hint: "Arrondi au pas supérieur, ex. 0,50" },
  { name: "min_price", label: "Prix plancher (€)", hint: "Aucun article en dessous" },
  { name: "shipping_flat_rate", label: "Livraison (€)", hint: "Forfait par commande" },
  { name: "free_shipping_from", label: "Livraison offerte dès (€)", hint: "Laisser vide pour désactiver" },
];

export default async function PricingPage({ searchParams }: Props) {
  const { ok } = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data: settings }, { data: materials }] = await Promise.all([
    supabase.from("pricing_settings").select("*").eq("id", 1).single<PricingSettings>(),
    supabase.from("materials").select("*").order("name").returns<Material[]>(),
  ]);
  if (!settings) return <p>Exécutez d&apos;abord supabase/schema.sql.</p>;

  return (
    <div className="max-w-4xl space-y-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Prix et matières</h1>
      {ok && (
        <p role="status" className="rounded-lg bg-ok/10 p-3 text-sm text-ok">
          Enregistré. Les prix de toutes les déclinaisons ont été recalculés.
        </p>
      )}

      <PriceSimulator settings={settings} materials={materials ?? []} />

      <section className="rounded-xl bg-sheet p-5">
        <h2 className="font-semibold">Réglages de calcul</h2>
        <p className="mt-1 text-sm text-muted">
          L&apos;enregistrement recalcule immédiatement les prix du catalogue (sauf les prix forcés).
        </p>
        <form action={saveSettings} className="mt-5 grid gap-5 sm:grid-cols-2">
          {FIELDS.map((f) => {
            const raw = settings[f.name];
            const value = raw == null ? "" : f.percent ? String(Math.round(Number(raw) * 10000) / 100) : String(raw);
            return (
              <div key={f.name}>
                <label className="label" htmlFor={f.name}>{f.label}</label>
                <input id={f.name} name={f.name} defaultValue={value} inputMode="decimal" className="field tabular" />
                <p className="mt-1 text-xs text-muted">{f.hint}</p>
              </div>
            );
          })}
          <div className="sm:col-span-2">
            <button className="btn">Enregistrer et recalculer les prix</button>
          </div>
        </form>
      </section>

      <section className="rounded-xl bg-sheet p-5">
        <h2 className="font-semibold">Matières</h2>
        <p className="mt-1 text-sm text-muted">Le nom doit correspondre exactement à la colonne matiere du CSV.</p>
        <ul className="mt-4 space-y-2">
          {(materials ?? []).map((m) => (
            <li key={m.id}>
              <form action={saveMaterial} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={m.id} />
                <div className="min-w-40 flex-1">
                  <label className="sr-only" htmlFor={`n-${m.id}`}>Nom</label>
                  <input id={`n-${m.id}`} name="name" defaultValue={m.name} className="field" />
                </div>
                <div className="w-36">
                  <label className="sr-only" htmlFor={`p-${m.id}`}>Prix au kg</label>
                  <input id={`p-${m.id}`} name="price_per_kg" defaultValue={String(m.price_per_kg)} inputMode="decimal" className="field tabular" />
                </div>
                <span className="pb-2 text-sm text-muted">€/kg</span>
                <button className="btn-ghost">Enregistrer</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={saveMaterial} className="mt-6 flex flex-wrap items-end gap-2 border-t border-line pt-5">
          <div className="min-w-40 flex-1">
            <label className="label" htmlFor="new-name">Nouvelle matière</label>
            <input id="new-name" name="name" placeholder="ex. ASA" className="field" required />
          </div>
          <div className="w-36">
            <label className="label" htmlFor="new-price">Prix au kg</label>
            <input id="new-price" name="price_per_kg" inputMode="decimal" placeholder="30" className="field tabular" required />
          </div>
          <button className="btn">Ajouter la matière</button>
        </form>
      </section>
    </div>
  );
}
