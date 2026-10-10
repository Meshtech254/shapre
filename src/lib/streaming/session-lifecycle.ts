import "server-only";
import { admin } from "@/lib/supabase/admin";
import { stopInferenceSession } from "@/lib/inference/client";
import { check } from "@/lib/api";
export async function expireSession(session: {
  id: string;
  status: string;
  inference_session_id: string | null;
  metadata: Record<string, unknown>;
}) {
  const expires = session.metadata.expires_at;
  if (
    typeof expires !== "string" ||
    Date.parse(expires) > Date.now() ||
    ["stopped", "failed"].includes(session.status)
  )
    return false;
  if (session.inference_session_id)
    await stopInferenceSession(session.inference_session_id).catch(() => {});
  check(
    (await admin().rpc("finish_session", { session_id: session.id })).error,
  );
  return true;
}
export async function reapOwnSessions(userId: string) {
  const { data, error } = await admin()
    .from("live_sessions")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["initializing", "connected", "live"]);
  check(error);
  for (const s of data ?? []) {
    if (Date.parse(s.heartbeat_at) < Date.now() - 120000) {
      if (s.inference_session_id)
        await stopInferenceSession(s.inference_session_id).catch(() => {});
      check((await admin().rpc("finish_session", { session_id: s.id })).error);
    } else await expireSession(s);
  }
}
