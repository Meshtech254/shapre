import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token_hash");
  if (token) {
    const db = await supabase();
    const { error } = await db.auth.verifyOtp({
      token_hash: token,
      type: "email",
    });
    if (!error) return NextResponse.redirect(new URL("/dashboard", url.origin));
  }
  return NextResponse.redirect(
    new URL("/login?error=confirmation", url.origin),
  );
}
