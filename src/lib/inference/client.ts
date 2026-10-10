import "server-only";
import { z } from "zod";
import { env, mockMode, inferenceConfig } from "@/lib/env";
import type { StudioSettings } from "@/lib/validation";
export { sessionSchema, type InferenceSession } from "./protocol";
import { sessionSchema } from "./protocol";
import { inferenceTransport } from "./transport";
const call = inferenceTransport({
  ...inferenceConfig,
  apiKey: env.INFERENCE_API_KEY,
});
export async function prepareFace(
  personaId: string,
  assets: { url: string; id: string }[],
) {
  return prepare(personaId, "face", assets);
}
export async function prepareVoice(
  personaId: string,
  assets: { url: string; id: string }[],
) {
  return prepare(personaId, "voice", assets);
}
async function prepare(id: string, kind: string, assets: unknown) {
  if (mockMode)
    return { status: "ready" as const, mock: true, asset_reference: undefined };
  return z
    .object({
      status: z.enum(["processing", "ready", "failed"]),
      asset_reference: z.string().optional(),
    })
    .parse(
      await call(`/v1/personas/${id}/${kind}/prepare`, "POST", { assets }),
    );
}
export async function createInferenceSession(
  personaId: string,
  settings: StudioSettings,
  maxDurationSeconds: number,
  watermark: boolean,
  identity?: {
    kind: "demo";
    face_asset_reference: string;
    voice_asset_reference: string | null;
    face_source_reference?: string;
    avatar_url?: string;
  },
) {
  if (mockMode)
    return sessionSchema.parse({
      id: `mock-${crypto.randomUUID()}`,
      status: "connected",
      mock: true,
    });
  const session = sessionSchema.parse(
    await call("/v1/sessions", "POST", {
      persona_id: personaId,
      settings,
      max_duration_seconds: maxDurationSeconds,
      watermark,
      ...(identity ? { identity } : {}),
    }),
  );
  if (session.mock)
    throw new Error("Production inference cannot return a mock session.");
  return session;
}
export async function getInferenceSession(id: string) {
  if (mockMode && id.startsWith("mock-"))
    return sessionSchema.parse({ id, status: "connected", mock: true });
  const session = sessionSchema.parse(
    await call(`/v1/sessions/${encodeURIComponent(id)}`, "GET"),
  );
  if (session.mock)
    throw new Error("Production inference cannot return mock output.");
  return session;
}
export async function stopInferenceSession(id: string) {
  if (mockMode && id.startsWith("mock-")) return;
  await call(`/v1/sessions/${encodeURIComponent(id)}/stop`);
}
export async function getPreparationStatus(id: string) {
  return z
    .object({
      face_status: z.enum([
        "missing",
        "uploaded",
        "processing",
        "ready",
        "failed",
      ]),
      voice_status: z.enum([
        "missing",
        "uploaded",
        "processing",
        "ready",
        "failed",
      ]),
    })
    .parse(await call(`/v1/personas/${id}/status`, "GET"));
}
export async function deleteInferencePersona(id: string) {
  if (!mockMode && inferenceConfig.url)
    await call(`/v1/personas/${id}`, "DELETE");
}
