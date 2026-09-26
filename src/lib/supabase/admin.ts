import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Client avec la clé service_role : contourne le RLS.
 * À utiliser UNIQUEMENT côté serveur (webhook Stripe, checkout).
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
