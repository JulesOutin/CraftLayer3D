"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { computePrice } from "@/lib/pricing";
import { recomputeAllPrices } from "@/lib/recompute";
import { sendOrderStatusEmail } from "@/lib/email";
import type { Material, OrderStatus, PricingSettings } from "@/lib/types";
import { ORDER_STATUSES } from "@/lib/types";

// ---------------------------------------------------------------- session

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

// ---------------------------------------------------------------- commandes

export async function updateOrder(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as OrderStatus;
  if (!ORDER_STATUSES.some((s) => s.value === status)) return;
  const tracking = String(formData.get("tracking_number") ?? "").trim() || null;

  const { data: before } = await supabase
    .from("orders")
    .select("email, order_number, status, tracking_number")
    .eq("id", id)
    .single();

  await supabase.from("orders").update({ status, tracking_number: tracking }).eq("id", id);
  revalidatePath("/admin", "layout");

  const statusChanged = before && before.status !== status;
  const trackingAdded = before && tracking && before.tracking_number !== tracking;
  if (before && (statusChanged || trackingAdded)) {
    await sendOrderStatusEmail({ email: before.email, order_number: before.order_number, status, tracking_number: tracking });
  }
}

// ---------------------------------------------------------------- produits

export async function toggleProduct(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id"));
  const active = formData.get("active") === "true";
  await supabase.from("products").update({ active: !active }).eq("id", id);
  revalidatePath("/admin/produits");
}

export async function updateStock(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id"));
  const raw = String(formData.get("stock_quantity") ?? "").trim();
  let stock: number | null = null;
  if (raw !== "") {
    const n = Number(raw.replace(",", "."));
    if (Number.isFinite(n)) stock = Math.max(0, Math.round(n));
  }
  await supabase.from("variants").update({ stock_quantity: stock }).eq("id", id);
  revalidatePath("/admin/produits");
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------- prix & matières

const num = (v: FormDataEntryValue | null, fallback = 0) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
};

export async function saveSettings(formData: FormData) {
  const { supabase } = await requireAdmin();
  const freeFrom = String(formData.get("free_shipping_from") ?? "").trim();
  await supabase
    .from("pricing_settings")
    .update({
      machine_rate_per_hour: num(formData.get("machine_rate_per_hour")),
      labor_rate_per_hour: num(formData.get("labor_rate_per_hour")),
      failure_rate: num(formData.get("failure_rate")) / 100,
      packaging_cost: num(formData.get("packaging_cost")),
      margin_multiplier: num(formData.get("margin_multiplier"), 1),
      vat_rate: num(formData.get("vat_rate")) / 100,
      rounding_step: num(formData.get("rounding_step"), 0.01),
      min_price: num(formData.get("min_price")),
      shipping_flat_rate: num(formData.get("shipping_flat_rate")),
      free_shipping_from: freeFrom ? num(freeFrom) : null,
    })
    .eq("id", 1);
  await recomputeAllPrices(supabase);
  revalidatePath("/", "layout");
  redirect("/admin/prix?ok=reglages");
}

export async function saveMaterial(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const price_per_kg = num(formData.get("price_per_kg"));
  if (!name) redirect("/admin/prix?erreur=nom");
  if (id) {
    await supabase.from("materials").update({ name, price_per_kg }).eq("id", id);
  } else {
    await supabase.from("materials").insert({ name, price_per_kg });
  }
  await recomputeAllPrices(supabase);
  revalidatePath("/", "layout");
  redirect("/admin/prix?ok=matiere");
}

// ---------------------------------------------------------------- import CSV

export type ImportRow = Record<string, string>;
export type ImportReport = {
  products: number;
  variants: number;
  errors: { line: number; message: string }[];
};

const REQUIRED = ["slug", "titre", "sku", "declinaison", "matiere", "grammes", "minutes_impression"] as const;

export async function importCatalog(rows: ImportRow[]): Promise<ImportReport> {
  const { supabase } = await requireAdmin();
  const report: ImportReport = { products: 0, variants: 0, errors: [] };

  if (!rows.length) return { ...report, errors: [{ line: 0, message: "Le fichier ne contient aucune ligne." }] };
  if (rows.length > 5000) return { ...report, errors: [{ line: 0, message: "5 000 lignes maximum par import." }] };

  const [{ data: settings }, { data: materials }] = await Promise.all([
    supabase.from("pricing_settings").select("*").eq("id", 1).single<PricingSettings>(),
    supabase.from("materials").select("*").returns<Material[]>(),
  ]);
  if (!settings || !materials) return { ...report, errors: [{ line: 0, message: "Réglages de prix introuvables." }] };
  const matByName = new Map(materials.map((m) => [m.name.trim().toLowerCase(), m]));

  const toNum = (s: string | undefined) => Number(String(s ?? "").replace(",", ".").trim());
  const isFalse = (s: string | undefined) => ["0", "non", "false", "no"].includes(String(s ?? "").trim().toLowerCase());

  type Parsed = {
    line: number;
    slug: string;
    product: { slug: string; title: string; description: string; image_url: string | null };
    variant: {
      sku: string;
      name: string;
      material_id: string;
      grams: number;
      print_minutes: number;
      labor_minutes: number;
      price_override: number | null;
      stock_quantity: number | null;
      active: boolean;
    };
    price: number;
  };

  const parsed: Parsed[] = [];
  const seenSku = new Set<string>();

  rows.forEach((r, i) => {
    const line = i + 2; // ligne 1 = en-têtes
    const row = Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim().toLowerCase(), (v ?? "").trim()]));
    const missing = REQUIRED.filter((k) => !row[k]);
    if (missing.length) return report.errors.push({ line, message: `Colonnes vides : ${missing.join(", ")}` });

    const slug = row.slug.toLowerCase();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
      return report.errors.push({ line, message: `Slug « ${row.slug} » invalide (minuscules, chiffres et tirets)` });
    if (seenSku.has(row.sku)) return report.errors.push({ line, message: `SKU « ${row.sku} » en double dans le fichier` });

    const material = matByName.get(row.matiere.toLowerCase());
    if (!material)
      return report.errors.push({ line, message: `Matière « ${row.matiere} » inconnue : créez-la dans Prix et matières` });

    const grams = toNum(row.grammes);
    const printMin = toNum(row.minutes_impression);
    const laborMin = row.minutes_finition ? toNum(row.minutes_finition) : 0;
    const override = row.prix_force ? toNum(row.prix_force) : null;
    const stock = row.stock ? toNum(row.stock) : null;
    if (
      [grams, printMin, laborMin].some((n) => !Number.isFinite(n) || n < 0) ||
      (override !== null && !(override > 0)) ||
      (stock !== null && (!Number.isFinite(stock) || stock < 0))
    )
      return report.errors.push({ line, message: "Valeur numérique invalide (grammes, minutes, prix ou stock)" });

    seenSku.add(row.sku);
    const variant = {
      sku: row.sku,
      name: row.declinaison,
      material_id: material.id,
      grams,
      print_minutes: Math.round(printMin),
      labor_minutes: Math.round(laborMin),
      stock_quantity: stock !== null ? Math.round(stock) : null,
      price_override: override,
      active: !isFalse(row.actif),
    };
    parsed.push({
      line,
      slug,
      product: {
        slug,
        title: row.titre,
        description: row.description ?? "",
        image_url: row.image_url || null,
      },
      variant,
      price: computePrice(variant, material, settings).price,
    });
  });

  // On n'importe rien si le fichier contient des erreurs : corriger puis relancer.
  if (report.errors.length) return report;

  // 1. Produits (la première ligne d'un slug fait foi pour titre, description et image)
  const products = new Map<string, Parsed["product"]>();
  for (const p of parsed) if (!products.has(p.slug)) products.set(p.slug, p.product);

  const { data: upserted, error: pErr } = await supabase
    .from("products")
    .upsert([...products.values()], { onConflict: "slug" })
    .select("id, slug");
  if (pErr || !upserted) return { ...report, errors: [{ line: 0, message: `Produits : ${pErr?.message}` }] };
  const idBySlug = new Map(upserted.map((p) => [p.slug, p.id]));
  report.products = upserted.length;

  // 2. Variantes (clé : SKU)
  const positions = new Map<string, number>();
  const variants = parsed.map((p) => {
    const pos = positions.get(p.slug) ?? 0;
    positions.set(p.slug, pos + 1);
    return { ...p.variant, product_id: idBySlug.get(p.slug)!, price: p.price, position: pos };
  });

  for (let i = 0; i < variants.length; i += 500) {
    const { error } = await supabase.from("variants").upsert(variants.slice(i, i + 500), { onConflict: "sku" });
    if (error) return { ...report, errors: [{ line: 0, message: `Variantes : ${error.message}` }] };
  }
  report.variants = variants.length;

  revalidatePath("/", "layout");
  return report;
}
