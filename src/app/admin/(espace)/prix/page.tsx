import { requireAdmin } from "@/lib/auth";
import type { Material, PricingSettings, ShippingRate } from "@/lib/types";
import { deleteShippingRate, saveMaterial, saveSettings, saveShippingRate } from "../../actions";
import { ConfirmForm } from "@/components/confirm-form";
import { PriceSimulator } from "@/components/price-simulator";

type Props = { searchParams: Promise<{ ok?: string; erreur?: string }> };

const ERREURS: Record<string, string> = {
  nom: "Le nom de la matière est obligatoire.",
  pays: "Code pays invalide (2 lettres, ex. FR).",
  poids: "Le poids maximum doit être un nombre positif, ou vide pour la tranche la plus lourde.",
  "doublon-livraison": "Une tranche existe déjà pour ce pays et ce poids maximum.",
  livraison: "L'enregistrement a échoué, réessayez.",
};

const FIELDS: { name: keyof PricingSettings; label: string; hint: string; percent?: boolean }[] = [
  { name: "machine_rate_per_hour", label: "Tarif machine (€/h)", hint: "Électricité, usure des buses et plateaux, amortissement" },
  { name: "labor_rate_per_hour", label: "Tarif main d'œuvre (€/h)", hint: "Appliqué aux minutes de finition" },
  { name: "failure_rate", label: "Taux d'échec (%)", hint: "Ajouté au coût matière et machine", percent: true },
  { name: "packaging_cost", label: "Emballage (€)", hint: "Par article" },
  { name: "margin_multiplier", label: "Coefficient de marge", hint: "Coût de revient × coefficient = prix HT" },
  { name: "vat_rate", label: "TVA (%)", hint: "0 en franchise en base de TVA", percent: true },
  { name: "rounding_step", label: "Arrondi (€)", hint: "Arrondi au pas supérieur, ex. 0,50" },
  { name: "min_price", label: "Prix plancher (€)", hint: "Aucun article en dessous" },
  { name: "shipping_flat_rate", label: "Livraison (€)", hint: "Tarif de repli si aucune tranche de poids ne correspond, ci-dessous" },
  { name: "free_shipping_from", label: "Livraison offerte dès (€)", hint: "Laisser vide pour désactiver" },
];

export default async function PricingPage({ searchParams }: Props) {
  const { ok, erreur } = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data: settings }, { data: materials }, { data: shippingRates }] = await Promise.all([
    supabase.from("pricing_settings").select("*").eq("id", 1).single<PricingSettings>(),
    supabase.from("materials").select("*").order("name").returns<Material[]>(),
    supabase.from("shipping_rates").select("*").order("country").order("max_grams").returns<ShippingRate[]>(),
  ]);
  if (!settings) return <p>Exécutez d&apos;abord supabase/schema.sql.</p>;

  return (
    <div className="max-w-4xl space-y-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Prix et matières</h1>
      {ok && (
        <p role="status" className="rounded-lg bg-ok/10 p-3 text-sm text-ok">
          {ok === "livraison" ? "Grille de livraison enregistrée." : "Enregistré. Les prix de toutes les déclinaisons ont été recalculés."}
        </p>
      )}
      {erreur && (
        <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
          {ERREURS[erreur] ?? "Une erreur est survenue."}
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

      <section className="rounded-xl bg-sheet p-5">
        <h2 className="font-semibold">Livraison par poids</h2>
        <p className="mt-1 text-sm text-muted">
          Une ligne par tranche de poids et par pays, à faire correspondre à votre grille tarifaire Mondial
          Relay (ou tout autre transporteur). Laissez « jusqu&apos;à » vide pour la tranche la plus lourde
          d&apos;un pays. Sans tranche correspondante, le tarif forfaitaire ci-dessus s&apos;applique.
        </p>
        <ul className="mt-4 space-y-2">
          {(shippingRates ?? []).map((r) => (
            <li key={r.id}>
              <form action={saveShippingRate} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={r.id} />
                <div className="w-20">
                  <label className="sr-only" htmlFor={`c-${r.id}`}>Pays</label>
                  <input id={`c-${r.id}`} name="country" defaultValue={r.country} maxLength={2} className="field tabular uppercase" />
                </div>
                <div className="w-32">
                  <label className="sr-only" htmlFor={`w-${r.id}`}>Jusqu&apos;à (g)</label>
                  <input id={`w-${r.id}`} name="max_grams" defaultValue={r.max_grams ?? ""} placeholder="illimité" inputMode="numeric" className="field tabular" />
                </div>
                <span className="pb-2 text-sm text-muted">g</span>
                <div className="w-28">
                  <label className="sr-only" htmlFor={`p-${r.id}`}>Prix</label>
                  <input id={`p-${r.id}`} name="price" defaultValue={String(r.price)} inputMode="decimal" className="field tabular" />
                </div>
                <span className="pb-2 text-sm text-muted">€</span>
                <button className="btn-ghost">Enregistrer</button>
                <ConfirmForm action={deleteShippingRate} confirmMessage="Supprimer cette tranche de livraison ?">
                  <input type="hidden" name="id" value={r.id} />
                  <button className="text-sm text-danger underline">Supprimer</button>
                </ConfirmForm>
              </form>
            </li>
          ))}
        </ul>
        <form action={saveShippingRate} className="mt-6 flex flex-wrap items-end gap-2 border-t border-line pt-5">
          <div className="w-20">
            <label className="label" htmlFor="new-country">Pays</label>
            <input id="new-country" name="country" defaultValue="FR" maxLength={2} className="field tabular uppercase" required />
          </div>
          <div className="w-32">
            <label className="label" htmlFor="new-max">Jusqu&apos;à</label>
            <input id="new-max" name="max_grams" placeholder="illimité" inputMode="numeric" className="field tabular" />
          </div>
          <span className="pb-2 text-sm text-muted">g</span>
          <div className="w-28">
            <label className="label" htmlFor="new-shipping-price">Prix</label>
            <input id="new-shipping-price" name="price" inputMode="decimal" placeholder="4.90" className="field tabular" required />
          </div>
          <span className="pb-2 text-sm text-muted">€</span>
          <button className="btn">Ajouter la tranche</button>
        </form>
      </section>
    </div>
  );
}
