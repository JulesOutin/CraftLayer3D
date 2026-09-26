import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { signOut } from "../actions";
import { SHOP } from "@/lib/config";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/commandes", label: "Commandes" },
  { href: "/admin/produits", label: "Produits" },
  { href: "/admin/import", label: "Import CSV" },
  { href: "/admin/prix", label: "Prix et matières" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAdmin();
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="border-b border-line bg-sheet md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-3 p-5 md:block">
          <Link href="/" className="font-[family-name:var(--font-display)] font-bold leading-tight">
            {SHOP.name}
          </Link>
          <p className="hidden truncate text-xs text-muted md:mt-1 md:block">{user.email}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:pb-0">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm hover:bg-plate">
              {n.label}
            </Link>
          ))}
        </nav>
        <form action={signOut} className="hidden p-5 md:block">
          <button className="text-sm text-muted underline">Se déconnecter</button>
        </form>
      </aside>
      <main className="min-w-0 p-5 md:p-10">{children}</main>
    </div>
  );
}
