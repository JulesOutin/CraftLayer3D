"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(
    params.get("erreur") === "acces" ? "Ce compte n'a pas les droits d'administration." : null,
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const { error } = await createClient().auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (error) {
      setError("E-mail ou mot de passe incorrect.");
      setLoading(false);
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-2xl bg-sheet p-8">
      <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold">Administration</h1>
      <div>
        <label className="label" htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" required autoComplete="email" className="field" />
      </div>
      <div>
        <label className="label" htmlFor="password">Mot de passe</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" className="field" />
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button className="btn w-full" disabled={loading}>{loading ? "Connexion…" : "Se connecter"}</button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
