type Material = { id: string; name: string };
export type CatalogQuery = { q?: string; matiere?: string; prixMin?: string; prixMax?: string };

export function CatalogFilters({ materials, values }: { materials: Material[]; values: CatalogQuery }) {
  const hasFilters = values.q || values.matiere || values.prixMin || values.prixMax;

  return (
    <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-sheet p-4">
      <div className="min-w-[10rem] flex-1">
        <label className="label" htmlFor="q">Rechercher</label>
        <input id="q" name="q" type="search" defaultValue={values.q} placeholder="Nom du produit" className="field" />
      </div>

      <div>
        <label className="label" htmlFor="matiere">Matière</label>
        <select id="matiere" name="matiere" defaultValue={values.matiere ?? ""} className="field">
          <option value="">Toutes</option>
          {materials.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="label" htmlFor="prixMin">Prix min</label>
        <input id="prixMin" name="prixMin" type="number" min={0} step="0.01" defaultValue={values.prixMin} placeholder="0" className="field tabular w-24" />
      </div>

      <div>
        <label className="label" htmlFor="prixMax">Prix max</label>
        <input id="prixMax" name="prixMax" type="number" min={0} step="0.01" defaultValue={values.prixMax} placeholder="€" className="field tabular w-24" />
      </div>

      <div className="flex gap-2">
        <button className="btn-ghost">Filtrer</button>
        {hasFilters && <a href="/" className="btn-ghost">Réinitialiser</a>}
      </div>
    </form>
  );
}
