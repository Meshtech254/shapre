import { z } from "zod";
const realtime = z.object({
  signalingUrl: z.string().url(),
  token: z.string(),
  iceServers: z
    .array(
      z.object({
        urls: z.union([z.string(), z.array(z.string())]),
        username: z.string().optional(),
        credential: z.string().optional(),
      }),
    )
    .default([]),
});
export const sessionSchema = z.object({
  id: z.string(),
  status: z.enum(["initializing", "connected", "live", "stopped", "failed"]),
  mock: z.boolean().default(false),
  latency_ms: z.number().optional(),
  realtime: realtime.optional(),
  output: z
    .object({
      signalingUrl: z.string().url(),
      token: z.string(),
      iceServers: realtime.shape.iceServers,
    })
    .optional(),
});
export type InferenceSession = z.infer<typeof sessionSchema>;
