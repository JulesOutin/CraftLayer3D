import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { computePrice } from "./pricing";
import type { Material, PricingSettings, Variant } from "./types";

/** Recalcule le prix de toutes les variantes et n'écrit que celles qui changent. */
export async function recomputeAllPrices(supabase: SupabaseClient) {
  const [{ data: settings }, { data: materials }, { data: variants }] = await Promise.all([
    supabase.from("pricing_settings").select("*").eq("id", 1).single<PricingSettings>(),
    supabase.from("materials").select("*").returns<Material[]>(),
    supabase.from("variants").select("*").returns<Variant[]>(),
  ]);
  if (!settings || !materials || !variants) throw new Error("Lecture des données impossible");

  const mat = new Map(materials.map((m) => [m.id, m]));
  const changes = variants
    .map((v) => {
      const m = mat.get(v.material_id);
      if (!m) return null;
      const { price } = computePrice(v, m, settings);
      return price !== Number(v.price) ? { id: v.id, price } : null;
    })
    .filter((x): x is { id: string; price: number } => x !== null);

  for (let i = 0; i < changes.length; i += 20) {
    const chunk = changes.slice(i, i + 20);
    const results = await Promise.all(
      chunk.map((c) => supabase.from("variants").update({ price: c.price }).eq("id", c.id)),
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
  }
  return changes.length;
}
