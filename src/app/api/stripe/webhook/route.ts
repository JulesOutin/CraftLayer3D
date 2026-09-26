import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendOrderConfirmationEmail } from "@/lib/email";

export const runtime = "nodejs";

/**
 * Reçoit checkout.session.completed et enregistre la commande dans Supabase.
 * Idempotent : si Stripe renvoie l'événement, la commande n'est pas dupliquée.
 */
export async function POST(req: Request) {
  const stripe = getStripe();
  const signature = req.headers.get("stripe-signature");
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature ?? "", process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (e) {
    console.error("Signature webhook invalide", e);
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  if (session.payment_status !== "paid") return NextResponse.json({ received: true });

  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("orders")
    .select("id")
    .eq("stripe_session_id", session.id)
    .maybeSingle();
  if (existing) return NextResponse.json({ received: true, duplicate: true });

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 100,
    expand: ["data.price.product"],
  });

  // Selon la version d'API Stripe, l'adresse est à l'un de ces deux endroits.
  const s = session as Stripe.Checkout.Session & {
    shipping_details?: { name?: string | null; address?: Stripe.Address | null } | null;
  };
  const shippingDetails = s.collected_information?.shipping_details ?? s.shipping_details ?? null;

  const email = session.customer_details?.email ?? null;
  const customerName = shippingDetails?.name ?? session.customer_details?.name ?? null;
  const subtotal = (session.amount_subtotal ?? 0) / 100;
  const shipping = (session.total_details?.amount_shipping ?? 0) / 100;
  const total = (session.amount_total ?? 0) / 100;

  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      stripe_session_id: session.id,
      stripe_payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : null,
      email,
      customer_name: customerName,
      shipping_address: {
        ...(shippingDetails?.address ?? {}),
        phone: session.customer_details?.phone ?? null,
      },
      subtotal,
      shipping,
      total,
      currency: session.currency ?? "eur",
      status: "paid",
    })
    .select("id, order_number")
    .single();

  if (error) {
    // Course entre deux livraisons du même événement : la contrainte unique a fait son travail
    if (error.code === "23505") return NextResponse.json({ received: true, duplicate: true });
    console.error("Insertion commande", error);
    return NextResponse.json({ error: "Enregistrement impossible" }, { status: 500 });
  }

  const items = lineItems.data.map((li) => {
    const product = li.price?.product as Stripe.Product | undefined;
    const [productTitle, variantName] = (product?.name ?? li.description ?? "Article").split(" — ");
    return {
      order_id: order.id,
      variant_id: product?.metadata?.variant_id ?? null,
      sku: product?.metadata?.sku ?? null,
      product_title: productTitle,
      variant_name: variantName ?? "",
      unit_price: (li.price?.unit_amount ?? 0) / 100,
      quantity: li.quantity ?? 1,
    };
  });

  const { error: itemsError } = await supabase.from("order_items").insert(items);
  if (itemsError) {
    console.error("Insertion lignes", itemsError);
    // On supprime la commande incomplète pour que Stripe réessaie proprement
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: "Enregistrement impossible" }, { status: 500 });
  }

  // Le paiement est déjà encaissé : un échec ici ne doit pas faire échouer le webhook
  // (Stripe le rejouerait et dupliquerait potentiellement le décrément).
  for (const it of items) {
    if (!it.variant_id) continue;
    const { error: stockError } = await supabase.rpc("decrement_stock", {
      p_variant_id: it.variant_id,
      p_qty: it.quantity,
    });
    if (stockError) console.error("Décrément stock", it.variant_id, stockError);
  }

  await sendOrderConfirmationEmail({
    email,
    order_number: order.order_number,
    customer_name: customerName,
    items: items.map((i) => ({
      product_title: i.product_title,
      variant_name: i.variant_name,
      quantity: i.quantity,
      unit_price: i.unit_price,
    })),
    subtotal,
    shipping,
    total,
  });

  return NextResponse.json({ received: true });
}
