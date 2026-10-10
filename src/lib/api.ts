import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { supabase } from "@/lib/supabase/server";
export class HttpError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function context(request?: Request) {
  if (request && !["GET", "HEAD"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      throw new HttpError("Invalid request origin.", 403);
  }
  const db = await supabase();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new HttpError("Please sign in again.", 401);
  return { db, user };
}
export async function ownedPersona(
  id: string,
  ctx: Awaited<ReturnType<typeof context>>,
) {
  const { data, error } = await ctx.db
    .from("personas")
    .select("*")
    .eq("id", id)
    .eq("user_id", ctx.user.id)
    .single();
  if (error || !data) throw new HttpError("Persona not found.", 404);
  return data;
}
export function check(error: { message: string } | null) {
  if (error)
    throw new HttpError("The operation could not be saved. Please retry.", 500);
}
export async function rateLimit(
  ctx: Awaited<ReturnType<typeof context>>,
  action: string,
  limit: number,
) {
  const { data, error } = await ctx.db.rpc("consume_rate_limit", {
    action_name: action,
    max_requests: limit,
    window_seconds: 60,
  });
  check(error);
  if (!data)
    throw new HttpError(
      "Too many requests. Please try again in a minute.",
      429,
    );
}
export function endpoint(fn: (request: Request) => Promise<unknown>) {
  return async (request: Request) => {
    try {
      return NextResponse.json(await fn(request), {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      const status =
        error instanceof HttpError
          ? error.status
          : error instanceof ZodError
            ? 400
            : 503;
      const message =
        error instanceof ZodError
          ? error.issues.map((i) => i.message).join(" ")
          : error instanceof Error
            ? error.message
            : "Something went wrong.";
      return NextResponse.json(
        { error: message },
        {
          status,
          headers: status === 429 ? { "Retry-After": "60" } : undefined,
        },
      );
    }
  };
}
