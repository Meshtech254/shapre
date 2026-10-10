import "server-only";
import { z } from "zod";
import { resolveInference } from "@/lib/inference/config";
const optional = z.preprocess(
  (v) => (v === "" ? undefined : v),
  z.string().optional(),
);
export const env = z
  .object({
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    NEXT_PUBLIC_SUPABASE_URL: optional,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: optional,
    SUPABASE_SERVICE_ROLE_KEY: optional,
    INFERENCE_API_URL: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.string().url().optional(),
    ),
    INFERENCE_API_KEY: optional,
    INFERENCE_MODE: z.enum(["mock", "local", "remote"]).optional(),
    LOCAL_INFERENCE_API_URL: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.string().url().optional(),
    ),
    INFERENCE_MOCK_MODE: z.enum(["true", "false"]).default("false"),
    OUTPUT_TOKEN_SECRET: optional,
  })
  .parse(process.env);
export const inferenceConfig = resolveInference({
  ...env,
  NODE_ENV: process.env.NODE_ENV,
});
export const mockMode = inferenceConfig.mode === "mock";
