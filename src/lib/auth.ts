import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";

/** Vérifie que l'utilisateur connecté a le rôle admin (app_metadata Supabase Auth), sinon redirige. */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  if (user.app_metadata?.role !== "admin") redirect("/admin/login?erreur=acces");

  return { supabase, user };
}
