import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
export function admin() {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error("Server storage credentials are not configured.");
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
