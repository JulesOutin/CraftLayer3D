import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { shippingForWeight } from "./pricing";
import type { PricingSettings, ShippingRate } from "./types";

/** Calcule les frais de livraison à partir du poids total, du pays et de la grille tarifaire. */
export async function quoteShipping(
  supabase: SupabaseClient,
  totalGrams: number,
  subtotal: number,
  country: string,
): Promise<number> {
  const [{ data: settings }, { data: rates }] = await Promise.all([
    supabase.from("pricing_settings").select("*").eq("id", 1).single<PricingSettings>(),
    supabase
      .from("shipping_rates")
      .select("country, max_grams, price")
      .returns<Pick<ShippingRate, "country" | "max_grams" | "price">[]>(),
  ]);
  if (!settings) return 0;
  return shippingForWeight(totalGrams, country, rates ?? [], settings, subtotal);
}
