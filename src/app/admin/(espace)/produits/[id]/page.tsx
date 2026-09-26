import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { computePrice, formatEUR } from "@/lib/pricing";
import type { Material, PricingSettings, Product, Variant } from "@/lib/types";
import { ConfirmForm } from "@/components/confirm-form";
import {
  createVariant,
  deleteProduct,
  deleteVariant,
  updateProduct,
  updateVariant,
  uploadProductImage,
} from "../../../actions";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; erreur?: string }>;
};

const ERREURS: Record<string, string> = {
  titre: "Le titre est obligatoire.",
  slug: "Slug invalide (minuscules, chiffres et tirets uniquement).",
  doublon: "Ce slug est déjà utilisé par un autre produit.",
  variante: "Nom, SKU et matière sont obligatoires pour une déclinaison.",
  sku: "Ce SKU est déjà utilisé par une autre déclinaison.",
  enregistrement: "L'enregistrement a échoué, réessayez.",
  image: "L'image n'a pas pu être envoyée (formats acceptés : jpg, png, webp…).",
  "image-taille": "L'image dépasse 5 Mo.",
};

const OK: Record<string, string> = {
  produit: "Produit enregistré.",
  variante: "Déclinaison enregistrée.",
  creation: "Produit créé. Ajoutez au moins une déclinaison pour pouvoir le vendre.",
  suppression: "Déclinaison supprimée.",
  image: "Image mise à jour.",
};

export default async function EditProduct({ params, searchParams }: Props) {
  const { id } = await params;
  const { ok, erreur } = await searchParams;
  const { supabase } = await requireAdmin();

  const [{ data: product }, { data: materials }, { data: settings }] = await Promise.all([
    supabase.from("products").select("*, variants(*)").eq("id", id)
      .single<Product & { variants: Variant[] }>(),
    supabase.from("materials").select("*").order("name").returns<Material[]>(),
    supabase.from("pricing_settings").select("*").eq("id", 1).single<PricingSettings>(),
  ]);
  if (!product) notFound();

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">Modifier l&apos;annonce</h1>
        <Link href="/admin/produits" className="text-sm text-muted underline">Retour aux produits</Link>
      </div>

      {ok && (
        <p role="status" className="rounded-lg bg-ok/10 p-3 text-sm text-ok">
          {OK[ok] ?? "Enregistré."}
        </p>
      )}
      {erreur && (
        <p role="alert" className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
          {ERREURS[erreur] ?? "Une erreur est survenue."}
        </p>
      )}

      <section className="rounded-xl bg-sheet p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-semibold">Fiche produit</h2>
          <ConfirmForm
            action={deleteProduct}
            confirmMessage={`Supprimer « ${product.title} » et toutes ses déclinaisons ? Cette action est irréversible.`}
          >
            <input type="hidden" name="id" value={product.id} />
            <button className="text-sm text-danger underline">Supprimer le produit</button>
          </ConfirmForm>
        </div>

        <div className="mt-4 flex flex-wrap items-start gap-4">
          <div className="layers h-28 w-28 shrink-0 overflow-hidden rounded-xl">
            {product.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.image_url} alt="" className="h-full w-full object-contain p-2" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs text-muted">Pas de photo</div>
            )}
          </div>
          <form action={uploadProductImage} className="flex-1 space-y-2">
            <input type="hidden" name="product_id" value={product.id} />
            <label className="label" htmlFor="file">Envoyer une photo</label>
            <input id="file" name="file" type="file" accept="image/*" className="field" />
            <button className="btn-ghost text-sm">Envoyer</button>
            <p className="text-xs text-muted">JPG, PNG ou WebP, 5 Mo maximum.</p>
          </form>
        </div>

        <form action={updateProduct} className="mt-6 space-y-4">
          <input type="hidden" name="id" value={product.id} />
          <div>
            <label className="label" htmlFor="title">Titre</label>
            <input id="title" name="title" defaultValue={product.title} className="field" required />
          </div>
          <div>
            <label className="label" htmlFor="slug">Slug</label>
            <input id="slug" name="slug" defaultValue={product.slug} className="field" required />
            <p className="mt-1 text-xs text-muted">Utilisé dans l&apos;URL : /produits/{product.slug}</p>
          </div>
          <div>
            <label className="label" htmlFor="description">Description</label>
            <textarea id="description" name="description" defaultValue={product.description} rows={5} className="field" />
          </div>
          <div>
            <label className="label" htmlFor="image_url">URL de l&apos;image</label>
            <input id="image_url" name="image_url" defaultValue={product.image_url ?? ""} className="field" placeholder="https://..." />
          </div>
          <button className="btn">Enregistrer le produit</button>
        </form>
      </section>

      <section className="rounded-xl bg-sheet p-5">
        <h2 className="font-semibold">Déclinaisons</h2>
        <div className="mt-4 space-y-5">
          {[...product.variants].sort((a, b) => a.position - b.position).map((v) => {
            const m = (materials ?? []).find((x) => x.id === v.material_id);
            const preview = m && settings ? computePrice(v, m, settings) : null;
            return (
              <form
                key={v.id}
                action={updateVariant}
                className="grid gap-3 border-t border-line pt-5 first:border-t-0 first:pt-0 sm:grid-cols-2"
              >
                <input type="hidden" name="id" value={v.id} />
                <input type="hidden" name="product_id" value={product.id} />
                <div>
                  <label className="label" htmlFor={`name-${v.id}`}>Déclinaison</label>
                  <input id={`name-${v.id}`} name="name" defaultValue={v.name} className="field" required />
                </div>
                <div>
                  <label className="label" htmlFor={`sku-${v.id}`}>SKU</label>
                  <input id={`sku-${v.id}`} name="sku" defaultValue={v.sku} className="field" required />
                </div>
                <div>
                  <label className="label" htmlFor={`mat-${v.id}`}>Matière</label>
                  <select id={`mat-${v.id}`} name="material_id" defaultValue={v.material_id} className="field" required>
                    {(materials ?? []).map((mat) => (
                      <option key={mat.id} value={mat.id}>{mat.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label" htmlFor={`g-${v.id}`}>Grammes</label>
                    <input id={`g-${v.id}`} name="grams" defaultValue={String(v.grams)} inputMode="decimal" className="field tabular" />
                  </div>
                  <div>
                    <label className="label" htmlFor={`pm-${v.id}`}>Impr. (min)</label>
                    <input id={`pm-${v.id}`} name="print_minutes" defaultValue={String(v.print_minutes)} inputMode="decimal" className="field tabular" />
                  </div>
                  <div>
                    <label className="label" htmlFor={`lm-${v.id}`}>Finition (min)</label>
                    <input id={`lm-${v.id}`} name="labor_minutes" defaultValue={String(v.labor_minutes)} inputMode="decimal" className="field tabular" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label" htmlFor={`po-${v.id}`}>Prix forcé (€, optionnel)</label>
                    <input
                      id={`po-${v.id}`}
                      name="price_override"
                      defaultValue={v.price_override != null ? String(v.price_override) : ""}
                      inputMode="decimal"
                      placeholder={preview ? formatEUR(preview.price) : ""}
                      className="field tabular"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor={`pos-${v.id}`}>Ordre d&apos;affichage</label>
                    <input id={`pos-${v.id}`} name="position" defaultValue={String(v.position)} inputMode="numeric" className="field tabular" />
                  </div>
                </div>
                <div className="flex items-end justify-between gap-3 sm:col-span-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="active" defaultChecked={v.active} />
                    Déclinaison active
                  </label>
                  <div className="flex items-center gap-3">
                    <button className="btn-ghost text-sm">Enregistrer</button>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <ConfirmForm
                    action={deleteVariant}
                    confirmMessage={`Supprimer la déclinaison « ${v.name} » ?`}
                  >
                    <input type="hidden" name="id" value={v.id} />
                    <input type="hidden" name="product_id" value={product.id} />
                    <button className="text-sm text-danger underline">Supprimer cette déclinaison</button>
                  </ConfirmForm>
                </div>
              </form>
            );
          })}
        </div>

        <form action={createVariant} className="mt-6 grid gap-3 border-t border-line pt-5 sm:grid-cols-2">
          <input type="hidden" name="product_id" value={product.id} />
          <p className="font-medium sm:col-span-2">Nouvelle déclinaison</p>
          <div>
            <label className="label" htmlFor="new-name">Déclinaison</label>
            <input id="new-name" name="name" placeholder="ex. Rouge — M" className="field" required />
          </div>
          <div>
            <label className="label" htmlFor="new-sku">SKU</label>
            <input id="new-sku" name="sku" className="field" required />
          </div>
          <div>
            <label className="label" htmlFor="new-mat">Matière</label>
            <select id="new-mat" name="material_id" className="field" required defaultValue="">
              <option value="" disabled>Choisir…</option>
              {(materials ?? []).map((mat) => (
                <option key={mat.id} value={mat.id}>{mat.name}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label" htmlFor="new-g">Grammes</label>
              <input id="new-g" name="grams" inputMode="decimal" className="field tabular" required />
            </div>
            <div>
              <label className="label" htmlFor="new-pm">Impr. (min)</label>
              <input id="new-pm" name="print_minutes" inputMode="decimal" className="field tabular" required />
            </div>
            <div>
              <label className="label" htmlFor="new-lm">Finition (min)</label>
              <input id="new-lm" name="labor_minutes" inputMode="decimal" defaultValue="0" className="field tabular" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="new-po">Prix forcé (€, optionnel)</label>
            <input id="new-po" name="price_override" inputMode="decimal" className="field tabular" />
          </div>
          <div className="sm:col-span-2">
            <button className="btn">Ajouter la déclinaison</button>
          </div>
        </form>
      </section>
    </div>
  );
}
