import Link from "next/link";
import { CartProvider } from "@/components/cart";
import { CartLink } from "@/components/cart-link";
import { SHOP } from "@/lib/config";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
        <Link href="/" className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight">
          {SHOP.name}
        </Link>
        <CartLink />
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-20">{children}</main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-8 text-sm text-muted sm:flex-row sm:justify-between">
          <p>{SHOP.name}, {SHOP.tagline.toLowerCase()}.</p>
          <p>
            Une question : <a className="underline" href={`mailto:${SHOP.contactEmail}`}>{SHOP.contactEmail}</a>
          </p>
        </div>
      </footer>
    </CartProvider>
  );
}
