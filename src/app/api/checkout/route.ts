import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { shippingFor } from "@/lib/pricing";
import { SHOP } from "@/lib/config";

export const runtime = "nodejs";

type Item = { variantId: string; quantity: number };

export async function POST(req: Request) {
  let items: Item[];
  try {
    const body = await req.json();
    items = Array.isArray(body.items) ? body.items : [];
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  items = items
    .filter((i) => typeof i.variantId === "string" && Number.isInteger(i.quantity) && i.quantity > 0)
    .map((i) => ({ variantId: i.variantId, quantity: Math.min(i.quantity, 20) }));
  if (!items.length || items.length > 50) {
    return NextResponse.json({ error: "Panier vide ou invalide." }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Les prix viennent TOUJOURS de la base, jamais du navigateur.
  const { data: variants, error } = await supabase
    .from("variants")
    .select("id, sku, name, price, stock_quantity, active, products!inner(title, image_url, active)")
    .in("id", items.map((i) => i.variantId));
  if (error) return NextResponse.json({ error: "Catalogue indisponible." }, { status: 500 });

  const byId = new Map((variants ?? []).map((v) => [v.id, v]));
  const lineItems = [];
  let subtotal = 0;

  for (const item of items) {
    const v = byId.get(item.variantId);
    // Supabase type la relation comme un tableau ou un objet selon le schéma généré
    const product = Array.isArray(v?.products) ? v?.products[0] : v?.products;
    if (!v || !v.active || !product?.active) {
      return NextResponse.json(
        { error: "Un article de votre panier n'est plus disponible. Retirez-le puis réessayez." },
        { status: 409 },
      );
    }
    if (v.stock_quantity !== null && v.stock_quantity < item.quantity) {
      return NextResponse.json(
        {
          error:
            v.stock_quantity <= 0
              ? `« ${product.title} — ${v.name} » est en rupture de stock.`
              : `Il ne reste que ${v.stock_quantity} en stock pour « ${product.title} — ${v.name} ».`,
        },
        { status: 409 },
      );
    }
    const unit = Math.round(Number(v.price) * 100);
    subtotal += (unit * item.quantity) / 100;
    lineItems.push({
      quantity: item.quantity,
      price_data: {
        currency: "eur",
        unit_amount: unit,
        product_data: {
          name: `${product.title} — ${v.name}`,
          ...(product.image_url?.startsWith("https://") ? { images: [product.image_url] } : {}),
          metadata: { variant_id: v.id, sku: v.sku },
        },
      },
    });
  }

  const { data: settings } = await supabase.from("pricing_settings").select("*").eq("id", 1).single();
  const shipping = settings ? shippingFor(subtotal, settings) : 0;
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(req.url).origin;

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      locale: "fr",
      line_items: lineItems,
      shipping_address_collection: { allowed_countries: [...SHOP.shippingCountries] },
      shipping_options: [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            display_name: shipping === 0 ? "Livraison offerte" : "Livraison suivie",
            fixed_amount: { amount: Math.round(shipping * 100), currency: "eur" },
          },
        },
      ],
      phone_number_collection: { enabled: true },
      success_url: `${site}/commande/merci?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${site}/panier`,
    });
    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("Stripe checkout", e);
    return NextResponse.json({ error: "Le paiement n'a pas pu démarrer. Réessayez dans un instant." }, { status: 502 });
  }
}
