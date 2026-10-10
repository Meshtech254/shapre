import { startStudioSession } from "@/lib/streaming/start-session";
import { platformSettings, getUserEntitlements } from "@/lib/platform/server";
import { demoLibrary } from "@/lib/demo-personas/server";
import { z } from "zod";
import {
  endpoint,
  context,
  ownedPersona,
  rateLimit,
  check,
  HttpError,
} from "@/lib/api";
import { admin } from "@/lib/supabase/admin";
import { personaInput, uuid, validateFile } from "@/lib/validation";
import {
  prepareFace,
  prepareVoice,
  getInferenceSession,
  stopInferenceSession,
  getPreparationStatus,
  deleteInferencePersona,
} from "@/lib/inference/client";
import { outputToken, verifyOutputToken } from "@/lib/streaming/output-token";
import { env, mockMode } from "@/lib/env";
import { expireSession } from "@/lib/streaming/session-lifecycle";
export const runtime = "nodejs";
export const maxDuration = 30;
const assetInput = z.object({
  kind: z.enum(["face", "voice"]),
  filename: z.string().min(1).max(200),
  mime: z.string(),
  size: z.number().int().positive(),
  consent: z.literal(true),
  duration: z.number().min(0).max(3600).optional(),
});
async function handler(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname.split("/").slice(3);
  const [resource, id, action] = path;
  if (resource === "demo-analytics" && process.env.ANALYTICS_ENABLED !== "true")
    return { ok: true, disabled: true };
  if (resource === "output" && request.method === "GET") {
    uuid.parse(id);
    if (!verifyOutputToken(id, url.searchParams.get("token") ?? ""))
      throw new HttpError("Output link expired or invalid.", 403);
    const { data: s, error } = await admin()
      .from("live_sessions")
      .select("*")
      .eq("id", id)
      .single();
    check(error);
    if (
      !s ||
      !["live", "connected"].includes(s.status) ||
      (await expireSession(s))
    )
      throw new HttpError("Session is offline.", 410);
    const inference = await getInferenceSession(s.inference_session_id);
    return {
      mock: mockMode && inference.mock,
      output: inference.output,
      status: inference.status,
      watermark: s.metadata.watermark === true,
    };
  }
  const ctx = await context(request);
  const db = ctx.db;
  const user = ctx.user;
  if (resource === "demo-personas" && request.method === "GET")
    return demoLibrary();
  if (resource === "demo-analytics" && request.method === "POST") {
    const settings = await platformSettings();
    await rateLimit(
      ctx,
      "demo-analytics",
      settings["analytics.demo_rate_limit"],
    );
    const quota = await admin()
      .from("demo_analytics")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", new Date(Date.now() - 86400000).toISOString());
    check(quota.error);
    if ((quota.count ?? 0) >= settings["analytics.event_quota"])
      throw new HttpError("Daily analytics quota reached.", 429);
    const input = z
      .object({
        events: z
          .array(
            z.object({
              event: z.enum([
                "demo_persona_viewed",
                "demo_persona_selected",
                "demo_to_custom_persona_clicked",
              ]),
              slug: z.string().regex(/^[a-z0-9-]{1,80}$/),
            }),
          )
          .min(1)
          .max(20),
      })
      .parse(await request.json());
    const demos = await demoLibrary();
    const rows = input.events.flatMap((e) => {
      const demo = demos.find((d) => d.slug === e.slug);
      return demo
        ? [{ user_id: user.id, demo_persona_id: demo.id, event: e.event }]
        : [];
    });
    if (rows.length)
      check((await admin().from("demo_analytics").insert(rows)).error);
    return { ok: true };
  }
  if (resource === "personas" && !id) {
    if (request.method === "GET") {
      const { data, error } = await db
        .from("personas")
        .select("*")
        .order("created_at", { ascending: false });
      check(error);
      return data;
    }
    if (request.method === "POST") {
      await rateLimit(ctx, "persona", 5);
      const input = personaInput.parse(await request.json());
      const policy = await getUserEntitlements(user.id);
      const { data, error } = await admin().rpc("create_platform_persona", {
        owner_id: user.id,
        test_normal: policy.testing,
        persona_name: input.name,
        persona_description: input.description,
        voice_consent: input.consentVoice,
      });
      if (error)
        throw new HttpError(
          error.message.includes("limit")
            ? "Persona limit reached for your plan."
            : "Could not create persona.",
        );
      return { id: data };
    }
  }
  if (resource === "personas" && id) {
    uuid.parse(id);
    const persona = await ownedPersona(id, ctx);
    const service = admin();
    if (
      request.method === "POST" &&
      ["upload", "asset"].includes(action) &&
      [persona.face_status, persona.voice_status].includes("processing")
    )
      throw new HttpError(
        "Wait for preparation to finish before changing assets.",
        409,
      );
    if (request.method !== "GET") {
      const { data: active, error } = await db
        .from("live_sessions")
        .select("id")
        .eq("persona_id", id)
        .in("status", ["initializing", "connected", "live"]);
      check(error);
      if (active?.length)
        throw new HttpError(
          "Stop your active studio session before changing persona assets.",
        );
    }
    if (request.method === "GET") {
      if (
        !mockMode &&
        (persona.face_status === "processing" ||
          persona.voice_status === "processing")
      ) {
        const result = await getPreparationStatus(id);
        const face =
          persona.face_status === "processing"
            ? result.face_status
            : persona.face_status;
        const voice =
          persona.voice_status === "processing"
            ? result.voice_status
            : persona.voice_status;
        const updates = {
          face_status: face,
          voice_status: voice,
          status:
            face === "failed" || voice === "failed"
              ? "failed"
              : face === "ready" && (voice === "missing" || voice === "ready")
                ? "ready"
                : "preparing",
        };
        check(
          (await service.from("personas").update(updates).eq("id", id)).error,
        );
        Object.assign(persona, updates);
      }
      const [faces, voices] = await Promise.all([
        db
          .from("persona_face_assets")
          .select("*")
          .eq("persona_id", id)
          .order("sort_order"),
        db.from("persona_voice_assets").select("*").eq("persona_id", id),
      ]);
      check(faces.error);
      check(voices.error);
      const sign = async (assets: typeof faces.data, bucket: string) =>
        Promise.all(
          (assets ?? [])
            .filter((a) => a.metadata?.uploaded === true)
            .map(async (a) => {
              const { data, error } = await service.storage
                .from(bucket)
                .createSignedUrl(a.storage_path, 900);
              check(error);
              return { ...a, url: data?.signedUrl };
            }),
        );
      return {
        persona,
        faces: await sign(faces.data, "persona-faces"),
        voices: await sign(voices.data, "persona-voices"),
        mock: mockMode,
      };
    }
    if (request.method === "DELETE" && !action) {
      await rateLimit(ctx, "delete", 10);
      const { data: active, error: activeError } = await db
        .from("live_sessions")
        .select("id")
        .eq("persona_id", id)
        .in("status", ["initializing", "connected", "live"]);
      check(activeError);
      if (active?.length)
        throw new HttpError(
          "Stop the active studio session before deleting this persona.",
        );
      await deleteInferencePersona(id);
      for (const bucket of ["persona-faces", "persona-voices"]) {
        const { data, error } = await service.storage
          .from(bucket)
          .list(`${user.id}/${id}`, { limit: 1000 });
        check(error);
        if (data?.length) {
          const removed = await service.storage
            .from(bucket)
            .remove(data.map((f) => `${user.id}/${id}/${f.name}`));
          check(removed.error);
        }
      }
      const { error } = await service
        .from("personas")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      check(error);
      return { ok: true };
    }
    if (action === "upload" && request.method === "POST") {
      await rateLimit(ctx, "upload", 30);
      const input = assetInput.parse(await request.json());
      const limits = await platformSettings();
      validateFile(input.kind, input.mime, input.size);
      if (
        input.size >
        limits[
          input.kind === "face"
            ? "personas.image_size_mb"
            : "personas.voice_size_mb"
        ] *
          1024 *
          1024
      )
        throw new HttpError("File exceeds the platform limit.");
      if (
        input.kind === "voice" &&
        (input.duration === undefined ||
          input.duration > limits["personas.voice_duration_seconds"])
      )
        throw new HttpError(
          "Provide a voice sample within the platform duration limit.",
        );
      const table =
        input.kind === "face" ? "persona_face_assets" : "persona_voice_assets";
      const bucket = input.kind === "face" ? "persona-faces" : "persona-voices";
      const { count, error: countError } = await db
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("persona_id", id);
      check(countError);
      if (
        (count ?? 0) >=
        (input.kind === "face" ? limits["personas.max_face_images"] : 1)
      )
        throw new HttpError(
          input.kind === "face"
            ? "Face image limit reached."
            : "Remove the current voice sample before replacing it.",
        );
      const assetId = crypto.randomUUID();
      const ext =
        input.mime === "image/jpeg"
          ? "jpg"
          : input.mime === "image/png"
            ? "png"
            : input.mime === "image/webp"
              ? "webp"
              : input.mime.includes("wav")
                ? "wav"
                : input.mime === "audio/mpeg"
                  ? "mp3"
                  : input.mime.includes("webm")
                    ? "webm"
                    : "m4a";
      const storagePath = `${user.id}/${id}/${assetId}.${ext}`;
      const { error: insertError } = await service.from(table).insert({
        id: assetId,
        persona_id: id,
        user_id: user.id,
        storage_path: storagePath,
        original_filename: input.filename,
        mime_type: input.mime,
        file_size: input.size,
        ...(input.kind === "voice"
          ? { duration_seconds: input.duration ?? null }
          : { sort_order: count ?? 0 }),
        metadata: {
          uploaded: false,
          consent_confirmed_at: new Date().toISOString(),
        },
      });
      check(insertError);
      const { data, error } = await service.storage
        .from(bucket)
        .createSignedUploadUrl(storagePath);
      if (error) {
        await service.from(table).delete().eq("id", assetId);
        check(error);
      }
      return { assetId, path: storagePath, token: data?.token, bucket };
    }
    if (action === "asset" && request.method === "POST") {
      const input = z
        .object({
          kind: z.enum(["face", "voice"]),
          assetId: uuid,
          operation: z.enum(["complete", "remove"]),
        })
        .parse(await request.json());
      const table =
        input.kind === "face" ? "persona_face_assets" : "persona_voice_assets";
      const bucket = input.kind === "face" ? "persona-faces" : "persona-voices";
      const { data: asset, error } = await db
        .from(table)
        .select("*")
        .eq("id", input.assetId)
        .eq("persona_id", id)
        .single();
      if (error || !asset) throw new HttpError("Asset not found.", 404);
      if (input.operation === "complete") {
        const { data: info, error: infoError } = await service.storage
          .from(bucket)
          .info(asset.storage_path);
        check(infoError);
        if (!info) throw new HttpError("Upload not found. Please retry.");
        validateFile(
          input.kind,
          info.contentType ?? asset.mime_type,
          Number(info.size),
        );
        if (Number(info.size) !== asset.file_size)
          throw new HttpError("Upload size does not match.");
        check(
          (
            await service
              .from(table)
              .update({ metadata: { ...asset.metadata, uploaded: true } })
              .eq("id", asset.id)
          ).error,
        );
      } else {
        check(
          (await service.storage.from(bucket).remove([asset.storage_path]))
            .error,
        );
        check((await service.from(table).delete().eq("id", asset.id)).error);
      }
      const { data: remaining, error: remainingError } = await db
        .from(table)
        .select("metadata")
        .eq("persona_id", id);
      check(remainingError);
      const hasAssets = remaining?.some((a) => a.metadata.uploaded);
      check(
        (
          await service
            .from("personas")
            .update({
              [`${input.kind}_status`]: hasAssets ? "uploaded" : "missing",
              status: "draft",
              [`consent_${input.kind}_confirmed_at`]: hasAssets
                ? new Date().toISOString()
                : null,
            })
            .eq("id", id)
        ).error,
      );
      return { ok: true };
    }
    if (action === "prepare" && request.method === "POST") {
      await rateLimit(ctx, "process", 10);
      const { kind } = z
        .object({ kind: z.enum(["face", "voice"]) })
        .parse(await request.json());
      if (persona.moderation_status === "blocked")
        throw new HttpError("This persona cannot be processed.", 403);
      if (!persona[`consent_${kind}_confirmed_at`])
        throw new HttpError("Rights confirmation required.", 403);
      const table =
        kind === "face" ? "persona_face_assets" : "persona_voice_assets";
      const { data: assets, error } = await db
        .from(table)
        .select("*")
        .eq("persona_id", id);
      check(error);
      const completed = (assets ?? []).filter(
        (a) => a.metadata.uploaded === true,
      );
      if (!completed.length)
        throw new HttpError("Upload assets before processing.");
      if (persona[`${kind}_status`] === "processing")
        throw new HttpError("This identity is already processing.", 409);
      const signed = await Promise.all(
        completed.map(async (a) => {
          const { data, error } = await service.storage
            .from(kind === "face" ? "persona-faces" : "persona-voices")
            .createSignedUrl(a.storage_path, 900);
          check(error);
          return { id: a.id, url: data!.signedUrl };
        }),
      );
      check(
        (
          await service
            .from("personas")
            .update({ [`${kind}_status`]: "processing", status: "preparing" })
            .eq("id", id)
        ).error,
      );
      try {
        const result = await (kind === "face"
          ? prepareFace(id, signed)
          : prepareVoice(id, signed));
        const face = kind === "face" ? result.status : persona.face_status;
        const voice = kind === "voice" ? result.status : persona.voice_status;
        check(
          (
            await service
              .from("personas")
              .update({
                [`${kind}_status`]: result.status,
                [`${kind}_preparation_mock`]: mockMode,
                status:
                  face === "ready" && (voice === "ready" || voice === "missing")
                    ? "ready"
                    : result.status === "failed"
                      ? "failed"
                      : "preparing",
              })
              .eq("id", id)
          ).error,
        );
        return result;
      } catch (e) {
        await service
          .from("personas")
          .update({ [`${kind}_status`]: "failed", status: "failed" })
          .eq("id", id);
        throw e;
      }
    }
  }
  if (resource === "sessions") {
    const service = admin();
    if (!id && request.method === "GET") {
      const { data: s, error } = await db
        .from("live_sessions")
        .select("*")
        .in("status", ["initializing", "connected", "live"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      check(error);
      if (!s || (await expireSession(s))) return null;
      if (!s.inference_session_id)
        return {
          sessionId: s.id,
          inference: { id: "pending", status: "initializing", mock: mockMode },
          watermark: s.metadata.watermark === true,
          outputUrl: "",
          trial: s.metadata.trial === true,
          expiresAt: s.metadata.expires_at,
        };
      const inference = {
        id: s.inference_session_id,
        status: s.status,
        mock: mockMode && s.metadata.mock === true,
      };
      return {
        sessionId: s.id,
        inference,
        watermark: s.metadata.watermark === true,
        outputUrl: `${env.NEXT_PUBLIC_APP_URL}/studio/output/${s.id}?token=${outputToken(s.id)}`,
        trial: s.metadata.trial === true,
        expiresAt: s.metadata.expires_at,
      };
    }
    if (!id && request.method === "POST") {
      await rateLimit(ctx, "session", 5);
      return startStudioSession(await request.json(), ctx);
    }
    if (id) {
      uuid.parse(id);
      const { data: s, error } = await db
        .from("live_sessions")
        .select("*")
        .eq("id", id)
        .eq("user_id", user.id)
        .single();
      if (error || !s) throw new HttpError("Session not found.", 404);
      if (action === "stop" && request.method === "POST") {
        if (["stopped", "failed"].includes(s.status)) return { ok: true };
        if (s.inference_session_id)
          await stopInferenceSession(s.inference_session_id).catch(() => {});
        check((await service.rpc("finish_session", { session_id: id })).error);
        return { ok: true };
      }
      if (request.method === "GET") {
        if (["stopped", "failed"].includes(s.status))
          return { status: s.status };
        if (await expireSession(s)) return { status: "stopped" };
        check(
          (
            await service
              .from("live_sessions")
              .update({ heartbeat_at: new Date().toISOString() })
              .eq("id", id)
          ).error,
        );
        if (!s.inference_session_id) return { status: "initializing" };
        let inference;
        try {
          inference = await getInferenceSession(s.inference_session_id);
        } catch (error) {
          await service.rpc("finish_session", { session_id: id });
          await service
            .from("live_sessions")
            .update({
              metadata: {
                ...s.metadata,
                error: "Inference connection was lost.",
              },
            })
            .eq("id", id);
          throw error;
        }
        check(
          (
            await service
              .from("live_sessions")
              .update({ latency_ms: inference.latency_ms ?? null })
              .eq("id", id)
          ).error,
        );
        if (["failed", "stopped"].includes(inference.status)) {
          check(
            (await service.rpc("finish_session", { session_id: id })).error,
          );
        } else if (inference.status === "live" && s.status !== "live") {
          check(
            (
              await service
                .from("live_sessions")
                .update({ status: "live" })
                .eq("id", id)
            ).error,
          );
        }
        return {
          status: inference.status,
          latency_ms: inference.latency_ms,
          mock: inference.mock,
        };
      }
    }
  }
  if (resource === "settings" && request.method === "POST") {
    const input = z
      .object({
        display_name: z.string().trim().max(80),
        streaming_defaults: z.object({
          camera: z.string().max(300),
          microphone: z.string().max(300),
          quality: z.enum(["Low Latency", "Balanced", "High Quality"]),
        }),
      })
      .parse(await request.json());
    check((await db.from("profiles").update(input).eq("id", user.id)).error);
    return { ok: true };
  }
  throw new HttpError("Route not found.", 404);
}
export const GET = endpoint(handler);
export const POST = endpoint(handler);
export const DELETE = endpoint(handler);
