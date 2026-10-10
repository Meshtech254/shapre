"use client";
export type DemoEvent =
  | "demo_persona_viewed"
  | "demo_persona_selected"
  | "demo_to_custom_persona_clicked";
const seen = new Set<string>();
let cooldownUntil = 0;
let sending = false;
let events: { event: DemoEvent; slug: string }[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
async function flush() {
  timer = undefined;
  if (sending || Date.now() < cooldownUntil) return;
  const batch = events.splice(0, 20);
  if (!batch.length) return;
  sending = true;
  try {
    const result = await fetch("/api/v1/demo-analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
    if (result.status === 429) {
      const retry = result.headers.get("Retry-After");
      const seconds = Number(retry);
      cooldownUntil =
        Number.isFinite(seconds) && seconds > 0
          ? Date.now() + seconds * 1000
          : Math.max(Date.now() + 60000, Date.parse(retry ?? "") || 0);
      events = [];
    }
  } catch {
    /* Best effort. Never retry failed events. */
  } finally {
    sending = false;
    if (events.length && Date.now() >= cooldownUntil && !timer)
      timer = setTimeout(flush, 800);
  }
}
export function trackEventOnce(
  event: DemoEvent,
  uniqueKey: string,
  payload: { slug: string },
) {
  if (process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== "true") return;
  const key = `${event}:${uniqueKey}`;
  if (seen.has(key) || seen.size >= 2000) return;
  seen.add(key);
  if (Date.now() < cooldownUntil) return;
  const { slug } = payload;
  events = [...events, { event, slug }].slice(-20);
  if (!timer && !sending) timer = setTimeout(flush, 800);
}
export function trackDemo(event: DemoEvent, slug: string) {
  trackEventOnce(event, slug, { slug });
}
