import { z } from "zod";
export const uuid = z.string().uuid();
export const personaInput = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(500).default(""),
  consentFace: z.literal(true),
  consentVoice: z.boolean().default(false),
});
export const studioSettings = z.object({
  resolution: z.enum(["640x480", "1280x720", "1920x1080"]).default("1280x720"),
  fps: z
    .union([z.literal(15), z.literal(24), z.literal(30), z.literal(60)])
    .default(30),
  faceEnabled: z.boolean().default(true),
  voiceEnabled: z.boolean().default(false),
  smoothing: z.number().min(0).max(100).default(50),
  expression: z.number().min(0).max(100).default(70),
  quality: z
    .enum(["Low Latency", "Balanced", "High Quality"])
    .default("Balanced"),
  similarity: z.number().min(0).max(100).default(75),
  pitch: z.number().min(-12).max(12).default(0),
  stability: z.number().min(0).max(100).default(50),
  noiseReduction: z.boolean().default(true),
});
export type StudioSettings = z.infer<typeof studioSettings>;
export const defaults = studioSettings.parse({});
export const faceTypes = ["image/jpeg", "image/png", "image/webp"];
export const voiceTypes = [
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/x-m4a",
  "audio/webm",
  "video/webm",
];
export function validateFile(
  kind: "face" | "voice",
  type: string,
  size: number,
) {
  if (!(kind === "face" ? faceTypes : voiceTypes).includes(type))
    throw new Error("Unsupported file format.");
  if (size <= 0 || size > (kind === "face" ? 10 : 50) * 1024 * 1024)
    throw new Error(
      `File must be between 1 byte and ${kind === "face" ? 10 : 50} MB.`,
    );
}
