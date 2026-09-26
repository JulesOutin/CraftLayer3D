import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { quoteShipping } from "@/lib/shipping";

export const runtime = "nodejs";

type Item = { variantId: string; quantity: number };

export async function POST(req: Request) {
  let items: Item[];
  let country: string;
  try {
    const body = await req.json();
    items = Array.isArray(body.items) ? body.items : [];
    country = typeof body.country === "string" && body.country ? body.country : "FR";
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  items = items
    .filter((i) => typeof i.variantId === "string" && Number.isInteger(i.quantity) && i.quantity > 0)
    .slice(0, 50)
    .map((i) => ({ variantId: i.variantId, quantity: Math.min(i.quantity, 20) }));
  if (!items.length) return NextResponse.json({ shipping: 0 });

  const supabase = await createClient();
  const { data: variants } = await supabase
    .from("variants")
    .select("id, grams, price")
    .in("id", items.map((i) => i.variantId));
  const byId = new Map((variants ?? []).map((v) => [v.id, v]));

  let totalGrams = 0;
  let subtotal = 0;
  for (const item of items) {
    const v = byId.get(item.variantId);
    if (!v) continue;
    totalGrams += Number(v.grams) * item.quantity;
    subtotal += Number(v.price) * item.quantity;
  }

  const shipping = await quoteShipping(supabase, totalGrams, subtotal, country.toUpperCase());
  return NextResponse.json({ shipping });
}
