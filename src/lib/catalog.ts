import { createClient } from "@supabase/supabase-js";
import type { PricingSettings, ProductWithVariants } from "./types";

/** Client anonyme pour le catalogue public (lecture seule, soumis au RLS). */
function publicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

const PRODUCT_SELECT =
  "id, slug, title, description, image_url, active, variants(id, product_id, sku, name, material_id, grams, print_minutes, labor_minutes, price_override, price, stock_quantity, active, position)";

export async function getProducts(): Promise<ProductWithVariants[]> {
  const { data, error } = await publicClient()
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("active", true)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Catalogue indisponible : ${error.message}`);
  return (data ?? [])
    .map((p) => ({
      ...p,
      variants: (p.variants ?? []).filter((v) => v.active).sort((a, b) => a.position - b.position),
    }))
    .filter((p) => p.variants.length > 0);
}

export async function getProductBySlug(slug: string): Promise<ProductWithVariants | null> {
  const { data, error } = await publicClient()
    .from("products")
    .select(PRODUCT_SELECT)
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const variants = (data.variants ?? []).filter((v) => v.active).sort((a, b) => a.position - b.position);
  return variants.length ? { ...data, variants } : null;
}

export async function getMaterialNames(): Promise<Record<string, string>> {
  const { data } = await publicClient().from("materials").select("id, name");
  return Object.fromEntries((data ?? []).map((m) => [m.id, m.name]));
}

/** Matières actives, triées par nom : utilisé pour le filtre du catalogue. */
export async function getMaterials(): Promise<{ id: string; name: string }[]> {
  const { data } = await publicClient()
    .from("materials")
    .select("id, name")
    .eq("active", true)
    .order("name");
  return data ?? [];
}

export async function getPublicSettings(): Promise<PricingSettings | null> {
  const { data } = await publicClient().from("pricing_settings").select("*").eq("id", 1).maybeSingle();
  return data;
}
