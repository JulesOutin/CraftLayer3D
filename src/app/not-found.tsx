import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <h1 className="stacked text-6xl font-extrabold">404</h1>
      <p className="mt-8 text-muted">Cette page n&apos;existe pas ou le produit n&apos;est plus en vente.</p>
      <Link href="/" className="btn mt-6">Voir le catalogue</Link>
    </main>
  );
}
