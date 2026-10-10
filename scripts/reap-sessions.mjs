import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
const { createClient } = require("@supabase/supabase-js");
if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  !process.env.SUPABASE_SERVICE_ROLE_KEY
)
  process.exit(0);
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
async function reap() {
  const result = await db.rpc("reap_stale_sessions");
  if (result.error) {
    if (!process.argv.includes("--watch")) {
      console.error(
        result.error.code === "PGRST202"
          ? "Apply migration 005 (and earlier migrations) before running session cleanup."
          : `Session cleanup failed: ${result.error.message}`,
      );
      process.exitCode = 1;
    }
    return;
  }
  const mode = process.env.INFERENCE_MODE ?? "mock",
    base =
      mode === "local"
        ? process.env.LOCAL_INFERENCE_API_URL
        : mode === "remote"
          ? process.env.INFERENCE_API_URL
          : null;
  if (base)
    for (const row of result.data ?? [])
      if (
        row.inference_session_id &&
        !row.inference_session_id.startsWith("mock-")
      )
        await fetch(
          `${base.replace(/\/$/, "")}/v1/sessions/${encodeURIComponent(row.inference_session_id)}/stop`,
          {
            method: "POST",
            headers: process.env.INFERENCE_API_KEY
              ? { Authorization: `Bearer ${process.env.INFERENCE_API_KEY}` }
              : {},
            signal: AbortSignal.timeout(5000),
          },
        ).catch(() => {});
}
await reap();
if (process.argv.includes("--watch"))
  setInterval(() => void reap().catch(() => {}), 30000);
