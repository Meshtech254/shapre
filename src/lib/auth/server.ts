import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { supabase } from "@/lib/supabase/server";
export const requireUser = cache(async function requireUser() {
  const db = await supabase();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) redirect("/login");
  return { db, user };
});
