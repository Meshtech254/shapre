import { z } from "zod";
import { settingSchemas, entitlementSchemas, type SettingKey } from "./schema";
const nullableReference = z.string().max(2000).nullable();
const imageUrl = z
  .string()
  .max(2000)
  .refine(
    (x) => (x.startsWith("/") && !x.startsWith("//")) || /^https?:\/\//.test(x),
    "Use an app path or HTTP image URL.",
  );
export const demoInput = z
  .object({
    name: z.string().trim().min(2).max(80),
    slug: z.string().regex(/^[a-z0-9-]{1,80}$/),
    description: z.string().max(500),
    category: z.enum([
      "realistic",
      "cyborg",
      "cartoon",
      "anime",
      "fantasy",
      "sci-fi",
      "robot",
    ]),
    style: z.string().min(1).max(80),
    thumbnail_url: imageUrl,
    preview_image_url: imageUrl,
    studio_avatar_url: imageUrl,
    face_source_reference: imageUrl.nullable(),
    face_asset_reference: nullableReference,
    voice_asset_reference: nullableReference,
    active: z.boolean(),
    featured: z.boolean(),
    sort_order: z.number().int().min(0).max(10000),
    inference_ready: z.boolean(),
    face_ready: z.boolean(),
    voice_ready: z.boolean(),
    metadata: z
      .object({
        placeholder: z.literal(false),
        avatar_ready: z.literal(true),
        ownership: z.string().min(3).max(500),
        asset_license: z.string().min(3).max(500),
      })
      .passthrough(),
    tags: z.array(z.string().max(50)).max(20).default([]),
    gender_presentation: z.string().max(80).nullable().default(null),
  })
  .refine(
    (x) => !x.inference_ready || (x.face_ready && !!x.face_asset_reference),
    "Inference readiness requires a prepared face asset.",
  )
  .refine(
    (x) => !x.voice_ready || !!x.voice_asset_reference,
    "Voice readiness requires a voice asset.",
  );
export const mutationInput = z.object({
  operation: z.enum([
    "setting",
    "credits",
    "trial_reset",
    "entitlement",
    "role",
    "demo",
    "stop_session",
  ]),
  target: z.string().min(1).max(100),
  changes: z.record(z.unknown()),
  reason: z.string().trim().min(3).max(500),
});
export function validateChanges(
  operation: string,
  target: string,
  changes: Record<string, unknown>,
) {
  if (operation === "setting") {
    const schema = settingSchemas[target as SettingKey];
    if (!schema) throw new Error("Unknown platform setting.");
    return { value: schema.parse(changes.value) };
  }
  z.string().uuid().parse(target);
  if (operation === "demo") return demoInput.parse(changes);
  if (operation === "role")
    return z
      .object({ role: z.enum(["user", "admin", "super_admin"]) })
      .parse(changes);
  if (operation === "credits")
    return z
      .object({
        mode: z.enum(["set", "adjust"]),
        amount: z.number().min(-1000000).max(1000000),
      })
      .refine(
        (x) => x.mode !== "set" || x.amount >= 0,
        "Balance must be nonnegative.",
      )
      .parse(changes);
  if (operation === "entitlement") {
    const input = z
      .object({
        key: z.enum(
          Object.keys(entitlementSchemas) as [
            keyof typeof entitlementSchemas,
            ...Array<keyof typeof entitlementSchemas>,
          ],
        ),
        value: z.unknown(),
        starts_at: z.string().datetime().nullable().optional(),
        expires_at: z.string().datetime().nullable().optional(),
      })
      .parse(changes);
    return {
      ...input,
      value: entitlementSchemas[input.key].parse(input.value),
    };
  }
  return {};
}
