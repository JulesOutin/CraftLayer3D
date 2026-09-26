import Stripe from "stripe";

let client: Stripe | null = null;

export function getStripe() {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY manquante");
    client = new Stripe(key);
  }
  return client;
}
