import "server-only";
import { admin } from "@/lib/supabase/admin";
import { context, ownedPersona, HttpError, check } from "@/lib/api";
import {
  createInferenceSession,
  stopInferenceSession,
} from "@/lib/inference/client";
import { env, mockMode } from "@/lib/env";
import { getUserEntitlements, platformSettings } from "@/lib/platform/server";
import { outputToken } from "./output-token";
import { studioSettings, uuid } from "@/lib/validation";
import { z } from "zod";
import { reapOwnSessions } from "./session-lifecycle";
const inputSchema = z
  .object({
    personaId: uuid.optional(),
    demoPersonaSlug: z
      .string()
      .regex(/^[a-z0-9-]{1,80}$/)
      .optional(),
    settings: studioSettings,
  })
  .refine((x) => !!x.personaId !== !!x.demoPersonaSlug, "Select one persona.");
export async function startStudioSession(
  body: unknown,
  ctx: Awaited<ReturnType<typeof context>>,
) {
  const input = inputSchema.parse(body),
    service = admin();
  const policy = await getUserEntitlements(ctx.user.id);
  const limits = await platformSettings();
  if (
    !policy.bypass_product_limits &&
    (!limits["stream.resolutions"].includes(input.settings.resolution) ||
      !limits["stream.fps"].includes(input.settings.fps))
  )
    throw new HttpError(
      "Choose a supported output resolution and FPS in Advanced controls.",
    );
  await reapOwnSessions(ctx.user.id);
  let personaId: string | null = null,
    demoId: string | null = null;
  let identity: Parameters<typeof createInferenceSession>[4];
  if (input.demoPersonaSlug) {
    const { data: demo, error } = await service
      .from("demo_personas")
      .select("*")
      .eq("slug", input.demoPersonaSlug)
      .single();
    if (error || !demo || !demo.active)
      throw new HttpError("Demo persona not found.", 404);
    if (
      !mockMode &&
      (!demo.face_ready || !demo.inference_ready || !demo.face_asset_reference)
    )
      throw new HttpError(
        "Prepare this demo's face source with your local or remote worker, then enable inference in Admin. Raw camera preview remains available.",
        409,
      );
    if (
      input.settings.voiceEnabled &&
      (!demo.voice_ready || !demo.voice_asset_reference)
    )
      throw new HttpError(
        "Disable voice transformation to use your normal microphone.",
      );
    demoId = demo.id;
    identity = {
      kind: "demo",
      face_asset_reference:
        demo.face_asset_reference ?? `source:${demo.face_source_reference}`,
      voice_asset_reference: input.settings.voiceEnabled
        ? demo.voice_asset_reference
        : null,
      ...(demo.face_source_reference
        ? {
            face_source_reference: new URL(
              demo.face_source_reference,
              env.NEXT_PUBLIC_APP_URL,
            ).toString(),
          }
        : {}),
      ...(demo.studio_avatar_url
        ? {
            avatar_url: new URL(
              demo.studio_avatar_url,
              env.NEXT_PUBLIC_APP_URL,
            ).toString(),
          }
        : {}),
    };
  } else {
    const persona = await ownedPersona(input.personaId!, ctx);
    if (
      !mockMode &&
      (persona.face_preparation_mock ||
        (input.settings.voiceEnabled && persona.voice_preparation_mock))
    )
      throw new HttpError(
        "Prepare identities with the selected inference worker before going live.",
      );
    if (input.settings.voiceEnabled && persona.voice_status !== "ready")
      throw new HttpError(
        "Prepare a voice sample or disable voice transformation.",
      );
    personaId = persona.id;
  }
  const reserved = await service.rpc("reserve_studio_session", {
    owner_id: ctx.user.id,
    persona: personaId,
    demo: demoId,
    session_metadata: { settings: input.settings, mock: mockMode },
    test_normal: policy.testing,
  });
  if (reserved.error) throw new HttpError(reserved.error.message, 409);
  const session = Array.isArray(reserved.data)
    ? reserved.data[0]
    : reserved.data;
  let externalId: string | undefined;
  try {
    const inference = await createInferenceSession(
      (demoId ?? personaId)!,
      input.settings,
      session.metadata.max_duration_seconds,
      session.metadata.watermark,
      identity,
    );
    externalId = inference.id;
    if (!inference.mock && !inference.realtime)
      throw new HttpError("The worker did not provide a realtime connection.");
    check(
      (
        await service
          .from("live_sessions")
          .update({
            inference_session_id: inference.id,
            status: "connected",
            started_at: new Date().toISOString(),
            heartbeat_at: new Date().toISOString(),
          })
          .eq("id", session.id)
          .eq("status", "initializing")
      ).error,
    );
    if (demoId)
      await service.from("demo_analytics").insert({
        user_id: ctx.user.id,
        demo_persona_id: demoId,
        session_id: session.id,
        event: "demo_studio_started",
      });
    return {
      sessionId: session.id,
      inference,
      outputUrl: `${env.NEXT_PUBLIC_APP_URL}/studio/output/${session.id}?token=${outputToken(session.id)}`,
      watermark: session.metadata.watermark,
      trial: session.metadata.trial,
      expiresAt: session.metadata.expires_at,
    };
  } catch (error) {
    if (externalId) await stopInferenceSession(externalId).catch(() => {});
    const finalized = await service.rpc("finish_session", {
      session_id: session.id,
    });
    await service
      .from("live_sessions")
      .update({
        ...(finalized.error ? {} : { status: "failed" }),
        metadata: {
          ...session.metadata,
          error:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "Session setup failed.",
        },
      })
      .eq("id", session.id);
    throw error;
  }
}
