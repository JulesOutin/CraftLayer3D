import { ImportForm } from "@/components/import-form";

export default function ImportPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Import CSV</h1>
      <div className="space-y-3 leading-relaxed text-muted">
        <p>
          Une ligne par déclinaison. Les lignes qui partagent le même <strong className="text-ink">slug</strong> forment un
          seul produit ; le titre, la description et l&apos;image sont lus sur la première. Un SKU déjà connu est mis à
          jour, un nouveau est créé. Le prix est calculé automatiquement, sauf si la colonne prix_force est remplie.
        </p>
        <p>
          Colonnes : slug, titre, description, image_url, sku, declinaison, matiere, grammes, minutes_impression,
          minutes_finition, prix_force, actif. Séparateur virgule ou point-virgule.
        </p>
        <a href="/modele-import.csv" download className="btn-ghost">Télécharger le modèle</a>
      </div>
      <ImportForm />
    </div>
  );
}
