import { z } from "zod";
export const settingSchemas = {
  "trial.enabled": z.boolean(),
  "trial.duration_seconds": z.number().int().min(10).max(86400),
  "trial.require_verification": z.boolean(),
  "trial.max_sessions": z.number().int().min(0).max(100),
  "trial.quality": z.enum(["Low Latency", "Balanced", "High Quality"]),
  "personas.free_limit": z.number().int().min(0).max(10000),
  "personas.creator_limit": z.number().int().min(0).max(10000),
  "personas.pro_limit": z.number().int().min(0).max(10000),
  "personas.max_face_images": z.number().int().min(1).max(100),
  "personas.image_size_mb": z.number().min(1).max(10),
  "personas.voice_duration_seconds": z.number().min(1).max(3600),
  "personas.voice_size_mb": z.number().min(1).max(50),
  "stream.max_session_minutes": z.number().min(1).max(1440),
  "stream.minimum_balance": z.number().min(0).max(10000),
  "stream.max_concurrent_sessions": z.number().int().min(1).max(20),
  "stream.resolutions": z
    .array(z.enum(["640x480", "1280x720", "1920x1080"]))
    .min(1),
  "stream.fps": z
    .array(
      z.union([z.literal(15), z.literal(24), z.literal(30), z.literal(60)]),
    )
    .min(1),
  "stream.quality_multipliers": z.object({
    "Low Latency": z.number().min(0.1).max(10),
    Balanced: z.number().min(0.1).max(10),
    "High Quality": z.number().min(0.1).max(10),
  }),
  "demo.enabled": z.boolean(),
  "demo.max_session_seconds": z.number().int().min(10).max(86400),
  "demo.featured_count": z.number().int().min(0).max(120),
  "analytics.demo_rate_limit": z.number().int().min(1).max(60),
  "analytics.event_quota": z.number().int().min(1).max(10000),
  "pricing.plans": z.object({
    free: z.number().min(0).max(10000),
    creator: z.number().min(0).max(10000),
    pro: z.number().min(0).max(10000),
    currency: z.string().regex(/^[A-Z]{3}$/),
  }),
  "plans.monthly_minutes": z.object({
    free: z.number().min(0).max(100000),
    creator: z.number().min(0).max(100000),
    pro: z.number().min(0).max(100000),
  }),
};
export type SettingKey = keyof typeof settingSchemas;
export const platformDefaults = {
  "trial.enabled": true,
  "trial.duration_seconds": 60,
  "trial.require_verification": false,
  "trial.max_sessions": 1,
  "trial.quality": "Balanced",
  "personas.free_limit": 1,
  "personas.creator_limit": 5,
  "personas.pro_limit": 20,
  "personas.max_face_images": 10,
  "personas.image_size_mb": 10,
  "personas.voice_duration_seconds": 300,
  "personas.voice_size_mb": 50,
  "stream.max_session_minutes": 120,
  "stream.minimum_balance": 0.01,
  "stream.max_concurrent_sessions": 1,
  "stream.resolutions": ["1280x720"],
  "stream.fps": [30],
  "stream.quality_multipliers": {
    "Low Latency": 1,
    Balanced: 1,
    "High Quality": 1,
  },
  "demo.enabled": true,
  "demo.max_session_seconds": 3600,
  "demo.featured_count": 6,
  "analytics.demo_rate_limit": 30,
  "analytics.event_quota": 500,
  "pricing.plans": { free: 0, creator: 29, pro: 99, currency: "USD" },
  "plans.monthly_minutes": { free: 30, creator: 600, pro: 2400 },
} as const;
export const entitlementSchemas = {
  unlimited_credits: z.boolean(),
  unlimited_streaming: z.boolean(),
  unlimited_personas: z.boolean(),
  bypass_trial_limit: z.boolean(),
  bypass_product_limits: z.boolean(),
  access_all_quality_modes: z.boolean(),
  access_preview_features: z.boolean(),
  persona_limit: z.number().int().min(0).max(10000),
  trial_seconds: z.number().int().min(10).max(86400),
  trial_enabled: z.boolean(),
  max_concurrent_sessions: z.number().int().min(1).max(20),
};
export type Role = "user" | "admin" | "super_admin";
export interface ProductPolicy {
  role: Role;
  testing: boolean;
  plan: "free" | "creator" | "pro";
  unlimited_credits: boolean;
  unlimited_streaming: boolean;
  unlimited_personas: boolean;
  bypass_trial_limit: boolean;
  bypass_product_limits: boolean;
  access_all_quality_modes: boolean;
  access_preview_features: boolean;
  persona_limit: number;
  trial_seconds: number;
  trial_enabled: boolean;
  max_concurrent_sessions: number;
  monthly_minutes: number;
  balance: number;
  used_minutes: number;
}
