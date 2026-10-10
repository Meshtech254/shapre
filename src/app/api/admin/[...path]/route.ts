import { cookies } from "next/headers";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { endpoint, context, rateLimit, check, HttpError } from "@/lib/api";
import { admin } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/platform/server";
import { mutationInput, validateChanges } from "@/lib/platform/admin-input";
import { stopInferenceSession, prepareFace } from "@/lib/inference/client";
import { env, mockMode } from "@/lib/env";
export const runtime = "nodejs";
async function handler(request: Request) {
  const ctx = await context(request);
  await requireAdmin(ctx.user.id);
  const resource = new URL(request.url).pathname.split("/")[3];
  if (request.method !== "POST")
    throw new HttpError("Method not allowed.", 405);
  await rateLimit(ctx, "admin", 30);
  if (resource === "test-mode") {
    const { enabled } = z
      .object({ enabled: z.boolean() })
      .parse(await request.json());
    const sessions = await admin()
      .from("live_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", ctx.user.id)
      .in("status", ["initializing", "connected", "live"]);
    check(sessions.error);
    if (sessions.count)
      throw new HttpError(
        "Stop your active sessions before switching testing mode.",
        409,
      );
    (await cookies()).set("shapre-test-user", String(enabled), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 3600,
    });
    return { ok: true };
  }
  if (resource === "avatar-upload") {
    const input = z
      .object({
        id: z.string().uuid(),
        role: z.enum(["thumbnail", "preview", "studio", "face_source"]),
        mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
        size: z.number().int().min(1).max(10485760),
        path: z.string().max(500).optional(),
        reason: z.string().trim().min(3).max(500),
      })
      .parse(await request.json());
    const service = admin();
    const { data: demo, error } = await service
      .from("demo_personas")
      .select("*")
      .eq("id", input.id)
      .single();
    if (error || !demo)
      throw new HttpError("Save the persona before uploading images.", 404);
    if (!input.path) {
      const ext =
        input.mime === "image/jpeg"
          ? "jpg"
          : input.mime === "image/png"
            ? "png"
            : "webp";
      const path = `${ctx.user.id}/${input.id}/${input.role}/${crypto.randomUUID()}.${ext}`;
      const signed = await service.storage
        .from("demo-avatars")
        .createSignedUploadUrl(path);
      check(signed.error);
      return { path, token: signed.data!.token, bucket: "demo-avatars" };
    }
    if (
      !input.path.startsWith(`${ctx.user.id}/${input.id}/${input.role}/`) ||
      !/^[a-f0-9/-]+\.(jpg|png|webp)$/.test(input.path)
    )
      throw new HttpError("Invalid upload path.");
    const info = await service.storage.from("demo-avatars").info(input.path);
    check(info.error);
    if (
      !info.data ||
      Number(info.data.size) !== input.size ||
      info.data.contentType !== input.mime
    )
      throw new HttpError("Uploaded file does not match.");
    const url = service.storage.from("demo-avatars").getPublicUrl(input.path)
      .data.publicUrl;
    const field = {
      thumbnail: "thumbnail_url",
      preview: "preview_image_url",
      studio: "studio_avatar_url",
      face_source: "face_source_reference",
    }[input.role];
    const changes = validateChanges("demo", input.id, {
      ...demo,
      [field]: url,
      metadata: { ...demo.metadata, placeholder: false, avatar_ready: true },
    });
    const result = await service.rpc("admin_mutate", {
      actor: ctx.user.id,
      operation: "demo",
      target: input.id,
      changes,
      note: input.reason,
    });
    check(result.error);
    revalidateTag("demo-personas");
    return { ok: true, url };
  }
  if (resource === "prepare-demo") {
    const input = z
      .object({ id: z.string().uuid(), reason: z.string().min(3).max(500) })
      .parse(await request.json());
    if (mockMode)
      throw new HttpError(
        "Mock demos can already start. Use local or remote mode to prepare a real face model.",
      );
    const service = admin(),
      { data: demo, error } = await service
        .from("demo_personas")
        .select("*")
        .eq("id", input.id)
        .single();
    check(error);
    if (!demo?.face_source_reference)
      throw new HttpError("Assign a face source first.");
    const result = await prepareFace(demo.id, [
      {
        id: demo.id,
        url: new URL(
          demo.face_source_reference,
          env.NEXT_PUBLIC_APP_URL,
        ).toString(),
      },
    ]);
    if (result.status !== "ready")
      return {
        status: result.status,
        message:
          "Preparation is still running. Assign the completed worker artifact after validation.",
      };
    const changes = validateChanges("demo", demo.id, {
      ...demo,
      face_asset_reference: result.asset_reference ?? demo.id,
      face_ready: true,
      inference_ready: true,
    });
    const saved = await service.rpc("admin_mutate", {
      actor: ctx.user.id,
      operation: "demo",
      target: demo.id,
      changes,
      note: input.reason,
    });
    check(saved.error);
    revalidateTag("demo-personas");
    return { status: "ready" };
  }
  if (resource !== "mutate") throw new HttpError("Route not found.", 404);
  const input = mutationInput.parse(await request.json());
  await requireAdmin(ctx.user.id, input.operation !== "demo");
  const changes = validateChanges(input.operation, input.target, input.changes);
  if (input.operation === "stop_session") {
    const result = await admin()
      .from("live_sessions")
      .select("inference_session_id")
      .eq("id", input.target)
      .single();
    check(result.error);
    if (result.data?.inference_session_id)
      await stopInferenceSession(result.data.inference_session_id).catch(
        () => {},
      );
  }
  const result = await admin().rpc("admin_mutate", {
    actor: ctx.user.id,
    operation: input.operation,
    target: input.target,
    changes,
    note: input.reason,
  });
  if (result.error) throw new HttpError(result.error.message, 409);
  revalidateTag("platform-settings");
  revalidateTag("demo-personas");
  return { ok: true };
}
export const POST = endpoint(handler);
