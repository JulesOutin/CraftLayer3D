import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getMaterialNames, getProductBySlug } from "@/lib/catalog";
import { SHOP } from "@/lib/config";
import { VariantPicker } from "@/components/variant-picker";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  return { title: product?.title ?? "Produit introuvable" };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [product, materials] = await Promise.all([getProductBySlug(slug), getMaterialNames()]);
  if (!product) notFound();

  return (
    <div className="grid gap-10 pt-4 md:grid-cols-2">
      <div className="layers aspect-square overflow-hidden rounded-3xl">
        {product.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.image_url} alt={product.title} className="h-full w-full object-contain p-8" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">Photo à venir</div>
        )}
      </div>

      <div className="max-w-lg">
        <Link href="/" className="text-sm text-muted hover:underline">
          Retour au catalogue
        </Link>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight">
          {product.title}
        </h1>
        {product.description && (
          <div className="mt-4 whitespace-pre-line leading-relaxed text-muted">{product.description}</div>
        )}

        <VariantPicker
          product={{ id: product.id, slug: product.slug, title: product.title, image_url: product.image_url }}
          variants={product.variants.map((v) => ({
            id: v.id,
            name: v.name,
            price: Number(v.price),
            material: materials[v.material_id] ?? "",
            grams: Number(v.grams),
            print_minutes: v.print_minutes,
            stock: v.stock_quantity,
          }))}
        />

        <p className="mt-6 text-sm text-muted">{SHOP.leadTime}.</p>
      </div>
    </div>
  );
}
