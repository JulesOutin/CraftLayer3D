import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { computePrice, formatDuration, formatEUR } from "@/lib/pricing";
import type { Material, PricingSettings, Product, Variant } from "@/lib/types";
import { toggleProduct, updateStock } from "../../actions";

export default async function ProductsAdmin() {
  const { supabase } = await requireAdmin();
  const [{ data: products }, { data: materials }, { data: settings }] = await Promise.all([
    supabase.from("products").select("*, variants(*)").order("created_at", { ascending: false })
      .returns<(Product & { variants: Variant[] })[]>(),
    supabase.from("materials").select("*").returns<Material[]>(),
    supabase.from("pricing_settings").select("*").eq("id", 1).single<PricingSettings>(),
  ]);
  const mat = new Map((materials ?? []).map((m) => [m.id, m]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Produits</h1>
        <Link href="/admin/import" className="btn">Importer un CSV</Link>
      </div>

      {(products ?? []).length === 0 && (
        <p className="rounded-xl bg-sheet p-6 text-muted">
          Aucun produit. <Link href="/admin/import" className="text-filament underline">Importez votre catalogue</Link> pour commencer.
        </p>
      )}

      {(products ?? []).map((p) => (
        <section key={p.id} className={`rounded-xl bg-sheet ${p.active ? "" : "opacity-60"}`}>
          <header className="flex flex-wrap items-center gap-3 border-b border-line p-4">
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold">{p.title}</h2>
              <p className="text-sm text-muted">/{p.slug}</p>
            </div>
            <Link href={`/produits/${p.slug}`} className="text-sm underline" target="_blank">Voir</Link>
            <form action={toggleProduct}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="active" value={String(p.active)} />
              <button className="btn-ghost text-sm">{p.active ? "Masquer de la boutique" : "Remettre en vente"}</button>
            </form>
          </header>
          <div className="overflow-x-auto">
            <table className="tabular w-full min-w-[46rem] text-sm">
              <thead className="text-left text-muted">
                <tr>
                  <th className="p-3 font-medium">Déclinaison</th>
                  <th className="p-3 font-medium">Matière</th>
                  <th className="p-3 text-right font-medium">Poids</th>
                  <th className="p-3 text-right font-medium">Impression</th>
                  <th className="p-3 text-right font-medium">Coût de revient</th>
                  <th className="p-3 text-right font-medium">Prix</th>
                  <th className="p-3 text-right font-medium">Marge</th>
                  <th className="p-3 text-right font-medium">Stock</th>
                </tr>
              </thead>
              <tbody>
                {[...p.variants].sort((a, b) => a.position - b.position).map((v) => {
                  const m = mat.get(v.material_id);
                  const b = m && settings ? computePrice(v, m, settings) : null;
                  const vat = Number(settings?.vat_rate ?? 0);
                  const margin = b ? Number(v.price) / (1 + vat) - b.cost : 0;
                  return (
                    <tr key={v.id} className="border-t border-line">
                      <td className="p-3">
                        {v.name}
                        <span className="block text-xs text-muted">{v.sku}{v.active ? "" : ", inactive"}</span>
                      </td>
                      <td className="p-3">{m?.name}</td>
                      <td className="p-3 text-right">{Number(v.grams)} g</td>
                      <td className="p-3 text-right">{formatDuration(v.print_minutes)}</td>
                      <td className="p-3 text-right" title={b ? `Matière ${formatEUR(b.material)}, machine ${formatEUR(b.machine)}, échecs ${formatEUR(b.failureAllowance)}, finition ${formatEUR(b.labor)}, emballage ${formatEUR(b.packaging)}` : ""}>
                        {b ? formatEUR(b.cost) : "?"}
                      </td>
                      <td className="p-3 text-right font-semibold">
                        {formatEUR(v.price)}
                        {v.price_override != null && <span className="block text-xs font-normal text-muted">prix forcé</span>}
                      </td>
                      <td className={`p-3 text-right ${margin < 0 ? "text-danger" : ""}`}>{formatEUR(margin)}</td>
                      <td className="p-3 text-right">
                        <form action={updateStock} className="flex items-center justify-end gap-1">
                          <input type="hidden" name="id" value={v.id} />
                          <input
                            type="number"
                            name="stock_quantity"
                            min={0}
                            defaultValue={v.stock_quantity ?? ""}
                            placeholder="illimité"
                            className="field tabular w-20 text-right"
                          />
                          <button className="btn-ghost text-xs">OK</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
