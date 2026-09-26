"use client";

export default function ShopError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="py-20 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold">La boutique ne répond pas</h1>
      <p className="mt-3 text-muted">Le catalogue n&apos;a pas pu être chargé. Réessayez dans un instant.</p>
      <button onClick={reset} className="btn mt-6">Réessayer</button>
    </div>
  );
}
