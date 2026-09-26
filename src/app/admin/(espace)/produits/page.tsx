import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import type { Material, PricingSettings, Product, Variant } from "@/lib/types";
import { ProductList } from "@/components/product-list";

type Props = { searchParams: Promise<{ ok?: string }> };

export default async function ProductsAdmin({ searchParams }: Props) {
  const { ok } = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data: products }, { data: materials }, { data: settings }] = await Promise.all([
    supabase.from("products").select("*, variants(*)").order("created_at", { ascending: false })
      .returns<(Product & { variants: Variant[] })[]>(),
    supabase.from("materials").select("*").returns<Material[]>(),
    supabase.from("pricing_settings").select("*").eq("id", 1).single<PricingSettings>(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Produits</h1>
        <div className="flex gap-2">
          <Link href="/admin/produits/nouveau" className="btn-ghost">+ Nouveau produit</Link>
          <Link href="/admin/import" className="btn">Importer un CSV</Link>
        </div>
      </div>

      {ok === "suppression" && (
        <p role="status" className="rounded-lg bg-ok/10 p-3 text-sm text-ok">Produit supprimé.</p>
      )}

      {(products ?? []).length === 0 ? (
        <p className="rounded-xl bg-sheet p-6 text-muted">
          Aucun produit. <Link href="/admin/import" className="text-filament underline">Importez votre catalogue</Link> ou{" "}
          <Link href="/admin/produits/nouveau" className="text-filament underline">créez-en un</Link> pour commencer.
        </p>
      ) : (
        <ProductList products={products ?? []} materials={materials ?? []} settings={settings ?? null} />
      )}
    </div>
  );
}
