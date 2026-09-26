import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createProduct } from "../../../actions";

type Props = { searchParams: Promise<{ erreur?: string }> };

const ERREURS: Record<string, string> = {
  titre: "Le titre est obligatoire.",
  slug: "Slug invalide (minuscules, chiffres et tirets uniquement).",
  doublon: "Ce slug est déjà utilisé par un autre produit.",
  enregistrement: "L'enregistrement a échoué, réessayez.",
};

export default async function NewProduct({ searchParams }: Props) {
  const { erreur } = await searchParams;
  await requireAdmin();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Nouveau produit</h1>
        <Link href="/admin/produits" className="text-sm text-muted underline">Retour aux produits</Link>
      </div>

      {erreur && (
        <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
          {ERREURS[erreur] ?? "Une erreur est survenue."}
        </p>
      )}

      <section className="rounded-xl bg-sheet p-5">
        <p className="mb-4 text-sm text-muted">
          Le produit est créé masqué de la boutique. Ajoutez au moins une déclinaison puis remettez-le en vente depuis la fiche produit.
        </p>
        <form action={createProduct} className="space-y-4">
          <div>
            <label className="label" htmlFor="title">Titre</label>
            <input id="title" name="title" className="field" required />
          </div>
          <div>
            <label className="label" htmlFor="slug">Slug</label>
            <input id="slug" name="slug" className="field" placeholder="ex. vase-torsade" required />
            <p className="mt-1 text-xs text-muted">Minuscules, chiffres et tirets uniquement.</p>
          </div>
          <div>
            <label className="label" htmlFor="description">Description</label>
            <textarea id="description" name="description" rows={5} className="field" />
          </div>
          <div>
            <label className="label" htmlFor="image_url">URL de l&apos;image (optionnel)</label>
            <input id="image_url" name="image_url" className="field" placeholder="https://..." />
            <p className="mt-1 text-xs text-muted">Vous pourrez aussi envoyer une photo depuis la fiche produit.</p>
          </div>
          <button className="btn">Créer le produit</button>
        </form>
      </section>
    </div>
  );
}
