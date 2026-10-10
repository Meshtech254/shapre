"use client";
import { createBrowserClient } from "@supabase/ssr";
export function browserSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key)
    throw new Error(
      "Supabase is not configured. Add the URL and anon key to .env.local.",
    );
  return createBrowserClient(url, key);
}
