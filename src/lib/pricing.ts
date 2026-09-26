import type { Material, PricingSettings, ShippingRate } from "./types";

type PrintSpec = {
  grams: number;
  print_minutes: number;
  labor_minutes: number;
  price_override?: number | null;
};

export type CostBreakdown = {
  material: number;
  machine: number;
  failureAllowance: number;
  labor: number;
  packaging: number;
  cost: number; // coût de revient total
  priceExVat: number;
  price: number; // prix final TTC arrondi
  overridden: boolean;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Coût de revient :
 *   matière  = grammes / 1000 × prix au kg
 *   machine  = heures d'impression × tarif machine
 *   échecs   = (matière + machine) × taux d'échec
 *   main d'œuvre = minutes de post-traitement / 60 × tarif horaire
 *   + emballage
 * Prix = coût × marge × (1 + TVA), arrondi au pas supérieur, avec un prix plancher.
 */
export function computePrice(
  spec: PrintSpec,
  material: Pick<Material, "price_per_kg">,
  s: PricingSettings,
): CostBreakdown {
  const materialCost = (Number(spec.grams) / 1000) * Number(material.price_per_kg);
  const machine = (Number(spec.print_minutes) / 60) * Number(s.machine_rate_per_hour);
  const failureAllowance = (materialCost + machine) * Number(s.failure_rate);
  const labor = (Number(spec.labor_minutes) / 60) * Number(s.labor_rate_per_hour);
  const packaging = Number(s.packaging_cost);
  const cost = materialCost + machine + failureAllowance + labor + packaging;

  const priceExVat = cost * Number(s.margin_multiplier);
  const withVat = priceExVat * (1 + Number(s.vat_rate));
  const step = Number(s.rounding_step) > 0 ? Number(s.rounding_step) : 0.01;
  // petite tolérance pour éviter qu'un 12.0000001 soit arrondi à 12.5
  let price = Math.ceil(withVat / step - 1e-9) * step;
  price = Math.max(price, Number(s.min_price));

  const overridden = spec.price_override != null && !Number.isNaN(Number(spec.price_override));

  return {
    material: round2(materialCost),
    machine: round2(machine),
    failureAllowance: round2(failureAllowance),
    labor: round2(labor),
    packaging: round2(packaging),
    cost: round2(cost),
    priceExVat: round2(priceExVat),
    price: overridden ? round2(Number(spec.price_override)) : round2(price),
    overridden,
  };
}

export function shippingFor(subtotal: number, s: Pick<PricingSettings, "shipping_flat_rate" | "free_shipping_from">) {
  if (s.free_shipping_from != null && subtotal >= Number(s.free_shipping_from)) return 0;
  return Number(s.shipping_flat_rate);
}

/**
 * Frais de livraison par tranche de poids et pays de destination (grille
 * renseignée dans Admin > Prix, censée refléter le contrat transporteur :
 * Mondial Relay ne fournit pas d'API de devis en temps réel, seulement la
 * création d'étiquette). Retombe sur le tarif forfaitaire si aucune tranche
 * ne correspond, et reste gratuit au-delà du seuil configuré.
 */
export function shippingForWeight(
  totalGrams: number,
  country: string,
  rates: Pick<ShippingRate, "country" | "max_grams" | "price">[],
  s: Pick<PricingSettings, "shipping_flat_rate" | "free_shipping_from">,
  subtotal: number,
): number {
  if (s.free_shipping_from != null && subtotal >= Number(s.free_shipping_from)) return 0;
  const bracket = rates
    .filter((r) => r.country === country)
    .sort((a, b) => (a.max_grams ?? Infinity) - (b.max_grams ?? Infinity))
    .find((r) => r.max_grams == null || totalGrams <= r.max_grams);
  return Number(bracket ? bracket.price : s.shipping_flat_rate);
}

export const formatEUR = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(n));

export const formatDuration = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
};
