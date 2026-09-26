import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { formatEUR } from "@/lib/pricing";
import { StatusBadge } from "@/components/status-badge";

export default async function Dashboard() {
  const { supabase } = await requireAdmin();
  const since30 = new Date(Date.now() - 30 * 864e5).toISOString();

  const [{ data: all }, { data: recent }, { count: toPrint }] = await Promise.all([
    supabase.from("orders").select("total, created_at, status").neq("status", "cancelled"),
    supabase
      .from("orders")
      .select("id, order_number, customer_name, email, total, status, created_at")
      .order("created_at", { ascending: false })
      .limit(8),
    supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["paid", "printing"]),
  ]);

  const orders = all ?? [];
  const last30 = orders.filter((o) => o.created_at >= since30);
  const sum = (list: { total: number }[]) => list.reduce((n, o) => n + Number(o.total), 0);

  // Chiffre d'affaires des 8 dernières semaines
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = Date.now() - i * 7 * 864e5;
    const start = end - 7 * 864e5;
    const total = sum(orders.filter((o) => {
      const t = new Date(o.created_at).getTime();
      return t >= start && t < end;
    }));
    return { label: new Date(start).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }), total };
  }).reverse();
  const max = Math.max(1, ...weeks.map((w) => w.total));

  const stats = [
    { label: "À traiter", value: String(toPrint ?? 0), hint: "payées ou en impression" },
    { label: "Ventes sur 30 jours", value: formatEUR(sum(last30)), hint: `${last30.length} commandes` },
    { label: "Panier moyen", value: formatEUR(last30.length ? sum(last30) / last30.length : 0), hint: "sur 30 jours" },
    { label: "Ventes totales", value: formatEUR(sum(orders)), hint: `${orders.length} commandes` },
  ];

  return (
    <div className="space-y-10">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Tableau de bord</h1>

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-sheet p-5">
            <dt className="text-sm text-muted">{s.label}</dt>
            <dd className="tabular mt-1 text-2xl font-semibold">{s.value}</dd>
            <dd className="text-xs text-muted">{s.hint}</dd>
          </div>
        ))}
      </dl>

      <section className="rounded-xl bg-sheet p-5">
        <h2 className="font-semibold">Ventes par semaine</h2>
        <div className="mt-6 flex h-40 items-end gap-2" role="img" aria-label="Chiffre d'affaires des 8 dernières semaines">
          {weeks.map((w) => (
            <div key={w.label} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full rounded-t-md bg-filament"
                style={{ height: `${Math.max(2, (w.total / max) * 120)}px` }}
                title={formatEUR(w.total)}
              />
              <span className="text-xs text-muted">{w.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="font-semibold">Dernières commandes</h2>
          <Link href="/admin/commandes" className="text-sm text-filament underline">Toutes les commandes</Link>
        </div>
        <ul className="mt-3 divide-y divide-line rounded-xl bg-sheet">
          {(recent ?? []).length === 0 && <li className="p-5 text-muted">Aucune commande pour le moment.</li>}
          {(recent ?? []).map((o) => (
            <li key={o.id} className="tabular flex flex-wrap items-center gap-x-4 gap-y-1 p-4 text-sm">
              <span className="font-semibold">n° {o.order_number}</span>
              <span className="min-w-0 flex-1 truncate">{o.customer_name ?? o.email}</span>
              <StatusBadge status={o.status} />
              <span className="w-24 text-right font-medium">{formatEUR(o.total)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
