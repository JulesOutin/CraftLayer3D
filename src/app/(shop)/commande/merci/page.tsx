import Link from "next/link";
import { ClearCart } from "@/components/clear-cart";
import { SHOP } from "@/lib/config";

export const metadata = { title: "Commande confirmée" };

export default function ThanksPage() {
  return (
    <div className="mx-auto max-w-xl py-20 text-center">
      <ClearCart />
      <h1 className="stacked text-5xl font-extrabold">Merci !</h1>
      <p className="mt-8 text-lg">Votre paiement est confirmé et votre commande part en impression.</p>
      <p className="mt-2 text-muted">
        Vous recevrez un reçu par e-mail. {SHOP.leadTime}.
      </p>
      <Link href="/" className="btn-ghost mt-8">Retour au catalogue</Link>
    </div>
  );
}
