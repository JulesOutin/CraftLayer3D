import Link from "next/link";
import { getMaterials, getProducts } from "@/lib/catalog";
import { formatEUR } from "@/lib/pricing";
import { SHOP } from "@/lib/config";
import { CatalogFilters, type CatalogQuery } from "@/components/catalog-filters";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<CatalogQuery> };

export default async function HomePage({ searchParams }: Props) {
  const query = await searchParams;
  const [products, materials] = await Promise.all([getProducts(), getMaterials()]);

  const term = (query.q ?? "").trim().toLowerCase();
  const min = query.prixMin ? Number(query.prixMin) : null;
  const max = query.prixMax ? Number(query.prixMax) : null;

  const filtered = products.filter((p) => {
    if (term && !p.title.toLowerCase().includes(term)) return false;
    if (query.matiere && !p.variants.some((v) => v.material_id === query.matiere)) return false;
    if (min != null || max != null) {
      const lowest = Math.min(...p.variants.map((v) => Number(v.price)));
      if (min != null && lowest < min) return false;
      if (max != null && lowest > max) return false;
    }
    return true;
  });
  const isFiltered = Boolean(term || query.matiere || min != null || max != null);

  return (
    <>
      <section className="grid gap-8 py-10 sm:py-16 md:grid-cols-[1.4fr_1fr] md:items-end">
        <h1 className="stacked text-[clamp(3rem,9vw,6.5rem)] font-extrabold">
          Imprimé
          <br />
          couche par
          <br />
          couche.
        </h1>
        <div className="max-w-sm space-y-3 text-muted md:pb-3">
          <p className="text-lg text-ink">
            Chaque pièce est lancée sur nos imprimantes quand vous la commandez, dans la matière et la couleur de
            votre choix.
          </p>
          <p>{SHOP.leadTime}.</p>
        </div>
      </section>

      {products.length > 0 && <CatalogFilters materials={materials} values={query} />}

      {products.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-10 text-center text-muted">
          Le catalogue est vide pour l&apos;instant. Ajoutez des produits depuis l&apos;administration.
        </p>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-10 text-center text-muted">
          Aucun produit ne correspond à ces critères.{" "}
          {isFiltered && <a href="/" className="underline">Réinitialiser les filtres</a>}
        </p>
      ) : (
        <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => {
            const prices = p.variants.map((v) => Number(v.price));
            const min = Math.min(...prices);
            const several = new Set(prices).size > 1;
            const outOfStock = p.variants.every((v) => v.stock_quantity !== null && v.stock_quantity <= 0);
            return (
              <li key={p.id}>
                <Link href={`/produits/${p.slug}`} className="group block">
                  <div className="layers aspect-[4/5] overflow-hidden rounded-2xl">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_url}
                        alt={p.title}
                        className={`h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.03] ${outOfStock ? "opacity-50" : ""}`}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted">Photo à venir</div>
                    )}
                  </div>
                  <div className="mt-3 flex items-baseline justify-between gap-3">
                    <h2 className="font-medium group-hover:underline">{p.title}</h2>
                    {outOfStock ? (
                      <p className="shrink-0 text-sm text-muted">Rupture de stock</p>
                    ) : (
                      <p className="tabular shrink-0 text-muted">
                        {several ? "dès " : ""}
                        <span className="font-semibold text-ink">{formatEUR(min)}</span>
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-muted">
                    {p.variants.length} {p.variants.length > 1 ? "déclinaisons" : "déclinaison"}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
