import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { formatEUR } from "@/lib/pricing";
import { ORDER_STATUSES } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { updateOrder } from "../../actions";

type Props = { searchParams: Promise<{ statut?: string }> };

type Address = {
  line1?: string; line2?: string | null; postal_code?: string; city?: string; country?: string; phone?: string | null;
};

export default async function OrdersPage({ searchParams }: Props) {
  const { statut } = await searchParams;
  const { supabase } = await requireAdmin();

  let query = supabase
    .from("orders")
    .select("*, order_items(id, product_title, variant_name, sku, unit_price, quantity)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (statut) query = query.eq("status", statut);
  const { data: orders } = await query;

  const filters = [{ value: "", label: "Toutes" }, ...ORDER_STATUSES];

  return (
    <div className="space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Commandes</h1>

      <nav className="flex flex-wrap gap-2" aria-label="Filtrer par statut">
        {filters.map((f) => (
          <Link
            key={f.value}
            href={f.value ? `/admin/commandes?statut=${f.value}` : "/admin/commandes"}
            className={`rounded-full border px-3 py-1 text-sm ${
              (statut ?? "") === f.value ? "border-ink bg-ink text-white" : "border-line bg-sheet"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {(orders ?? []).length === 0 && <p className="rounded-xl bg-sheet p-6 text-muted">Aucune commande avec ce statut.</p>}

      <ul className="space-y-3">
        {(orders ?? []).map((o) => {
          const a = (o.shipping_address ?? {}) as Address;
          return (
            <li key={o.id}>
              <details className="group rounded-xl bg-sheet">
                <summary className="tabular flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 p-4 text-sm">
                  <span className="font-semibold">n° {o.order_number}</span>
                  <span className="text-muted">
                    {new Date(o.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{o.customer_name ?? o.email}</span>
                  <StatusBadge status={o.status} />
                  <span className="w-24 text-right font-medium">{formatEUR(o.total)}</span>
                </summary>

                <div className="grid gap-6 border-t border-line p-4 text-sm lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <h3 className="font-semibold">À imprimer</h3>
                    <table className="tabular mt-2 w-full">
                      <tbody>
                        {o.order_items.map((it: { id: string; product_title: string; variant_name: string; sku: string | null; unit_price: number; quantity: number }) => (
                          <tr key={it.id} className="border-b border-line last:border-0">
                            <td className="py-2 pr-2 font-semibold">{it.quantity} ×</td>
                            <td className="py-2 pr-2">
                              {it.product_title}
                              <span className="block text-muted">{it.variant_name}{it.sku ? `, ${it.sku}` : ""}</span>
                            </td>
                            <td className="py-2 text-right">{formatEUR(it.unit_price * it.quantity)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="tabular mt-2 text-right text-muted">
                      Livraison {formatEUR(o.shipping)}, total <span className="font-semibold text-ink">{formatEUR(o.total)}</span>
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold">Livraison</h3>
                      <address className="mt-1 not-italic leading-relaxed">
                        {o.customer_name}<br />
                        {a.line1}{a.line2 ? <><br />{a.line2}</> : null}<br />
                        {a.postal_code} {a.city} {a.country}
                        {a.phone && <><br />{a.phone}</>}
                        <br /><a href={`mailto:${o.email}`} className="text-filament underline">{o.email}</a>
                      </address>
                    </div>

                    <form action={updateOrder} className="space-y-2">
                      <input type="hidden" name="id" value={o.id} />
                      <label className="label" htmlFor={`s-${o.id}`}>Statut</label>
                      <select id={`s-${o.id}`} name="status" defaultValue={o.status} className="field">
                        {ORDER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                      <label className="label" htmlFor={`t-${o.id}`}>Numéro de suivi</label>
                      <input id={`t-${o.id}`} name="tracking_number" defaultValue={o.tracking_number ?? ""} className="field" />
                      <button className="btn-ghost">Enregistrer</button>
                    </form>
                  </div>
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
