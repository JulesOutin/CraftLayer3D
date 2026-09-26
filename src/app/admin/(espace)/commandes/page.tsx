import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { formatEUR } from "@/lib/pricing";
import { ORDER_STATUSES } from "@/lib/types";
import { StatusBadge } from "@/components/status-badge";
import { setRelayPoint, updateOrder } from "../../actions";

type Props = { searchParams: Promise<{ statut?: string }> };

type Address = {
  line1?: string; line2?: string | null; postal_code?: string; city?: string; country?: string; phone?: string | null;
};

type RelayPoint = {
  id: string; name: string; address1: string; address2?: string; postcode: string; city: string; country: string;
};

export default async function OrdersPage({ searchParams }: Props) {
  const { statut } = await searchParams;
  const { supabase } = await requireAdmin();

  let query = supabase
    .from("orders")
    .select("*, order_items(id, product_title, variant_name, sku, unit_price, quantity, grams)")
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
          const relay = o.relay_point as RelayPoint | null;
          const needsRelay = o.delivery_mode === "relais" && !relay;
          const items: { id: string; product_title: string; variant_name: string; sku: string | null; unit_price: number; quantity: number; grams: number | null }[] = o.order_items;
          const totalGrams = items.reduce((sum, it) => sum + (it.grams ?? 0) * it.quantity, 0);
          return (
            <li key={o.id}>
              <details className="group rounded-xl bg-sheet">
                <summary className="tabular flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 p-4 text-sm">
                  <span className="font-semibold">n° {o.order_number}</span>
                  <span className="text-muted">
                    {new Date(o.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{o.customer_name ?? o.email}</span>
                  {needsRelay && (
                    <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
                      Point relais à choisir
                    </span>
                  )}
                  {o.notes && (
                    <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger">
                      À vérifier
                    </span>
                  )}
                  <StatusBadge status={o.status} />
                  <span className="w-24 text-right font-medium">{formatEUR(o.total)}</span>
                </summary>

                <div className="grid gap-6 border-t border-line p-4 text-sm lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    {o.notes && (
                      <p className="mb-3 rounded-lg bg-danger/10 p-3 text-sm text-danger">{o.notes}</p>
                    )}
                    <h3 className="font-semibold">À imprimer</h3>
                    <table className="tabular mt-2 w-full">
                      <tbody>
                        {items.map((it) => (
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
                      <h3 className="font-semibold">{relay ? "Point relais" : needsRelay ? "Point relais à choisir" : "Livraison"}</h3>
                      {relay ? (
                        <address className="mt-1 not-italic leading-relaxed">
                          <span className="font-medium">{relay.name}</span> ({relay.id})<br />
                          {relay.address1}{relay.address2 ? <><br />{relay.address2}</> : null}<br />
                          {relay.postcode} {relay.city} {relay.country}
                          <br /><span className="text-muted">Client : {o.customer_name}</span>
                          {a.phone && <><br /><span className="text-muted">{a.phone}</span></>}
                          <br /><a href={`mailto:${o.email}`} className="text-filament underline">{o.email}</a>
                        </address>
                      ) : needsRelay ? (
                        <>
                          <p className="mt-1 text-xs text-muted">
                            Adresse du client, pour trouver le point relais le plus proche sur{" "}
                            <a href="https://www.mondialrelay.fr/trouver-mon-point-relais/" target="_blank" className="text-filament underline">
                              mondialrelay.fr
                            </a>{" "}:
                          </p>
                          <address className="mt-1 not-italic leading-relaxed">
                            {o.customer_name}<br />
                            {a.line1}{a.line2 ? <><br />{a.line2}</> : null}<br />
                            {a.postal_code} {a.city} {a.country}
                            {a.phone && <><br />{a.phone}</>}
                            <br /><a href={`mailto:${o.email}`} className="text-filament underline">{o.email}</a>
                          </address>
                          <form action={setRelayPoint} className="mt-3 space-y-2 rounded-lg bg-plate p-3">
                            <input type="hidden" name="id" value={o.id} />
                            <label className="label" htmlFor={`ri-${o.id}`}>N° du point relais</label>
                            <input id={`ri-${o.id}`} name="relay_id" className="field" placeholder="ex. 066974" />
                            <label className="label" htmlFor={`rn-${o.id}`}>Nom</label>
                            <input id={`rn-${o.id}`} name="name" className="field" required />
                            <label className="label" htmlFor={`ra-${o.id}`}>Adresse</label>
                            <input id={`ra-${o.id}`} name="address1" className="field" required />
                            <div className="flex gap-2">
                              <div className="w-24">
                                <label className="label" htmlFor={`rp-${o.id}`}>CP</label>
                                <input id={`rp-${o.id}`} name="postcode" className="field tabular" required />
                              </div>
                              <div className="flex-1">
                                <label className="label" htmlFor={`rc-${o.id}`}>Ville</label>
                                <input id={`rc-${o.id}`} name="city" className="field" required />
                              </div>
                              <div className="w-16">
                                <label className="label" htmlFor={`rco-${o.id}`}>Pays</label>
                                <input id={`rco-${o.id}`} name="country" defaultValue="FR" maxLength={2} className="field tabular uppercase" />
                              </div>
                            </div>
                            <button className="btn-ghost text-sm">Enregistrer le point relais</button>
                          </form>
                        </>
                      ) : (
                        <address className="mt-1 not-italic leading-relaxed">
                          {o.customer_name}<br />
                          {a.line1}{a.line2 ? <><br />{a.line2}</> : null}<br />
                          {a.postal_code} {a.city} {a.country}
                          {a.phone && <><br />{a.phone}</>}
                          <br /><a href={`mailto:${o.email}`} className="text-filament underline">{o.email}</a>
                        </address>
                      )}
                    </div>

                    {totalGrams > 0 && (
                      <p className="tabular rounded-lg bg-plate p-3 text-sm">
                        Poids du colis : <span className="font-semibold">{Math.round(totalGrams)} g</span>
                      </p>
                    )}

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
