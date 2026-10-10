import { test } from "node:test";
import assert from "node:assert/strict";
import { trackDemo, trackEventOnce } from "../src/lib/demo-personas/analytics";
test("analytics deduplicates across batch flushes and backs off without retrying 429s", async () => {
  const original = globalThis.fetch;
  const originalAnalytics = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED;
  const requests: string[] = [];
  let limited = false;
  delete process.env.NEXT_PUBLIC_ANALYTICS_ENABLED;
  globalThis.fetch = async (_url, init) => {
    requests.push(String(init?.body));
    return new Response("{}", {
      status: limited ? 429 : 200,
      headers: limited ? { "Retry-After": "120" } : {},
    });
  };
  try {
    trackDemo("demo_persona_selected", "disabled-by-default");
    await new Promise((r) => setTimeout(r, 850));
    assert.equal(requests.length, 0);
    process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = "true";
    for (let i = 0; i < 50; i++) trackDemo("demo_persona_selected", "atlas");
    await new Promise((r) => setTimeout(r, 900));
    assert.equal(requests.length, 1);
    trackDemo("demo_persona_selected", "atlas");
    await new Promise((r) => setTimeout(r, 900));
    assert.equal(requests.length, 1);
    limited = true;
    trackEventOnce("demo_persona_viewed", "nova", { slug: "nova" });
    await new Promise((r) => setTimeout(r, 900));
    assert.equal(requests.length, 2);
    for (let i = 0; i < 50; i++)
      trackDemo("demo_persona_selected", `test-${i}`);
    await new Promise((r) => setTimeout(r, 900));
    assert.equal(requests.length, 2);
  } finally {
    globalThis.fetch = original;
    if (originalAnalytics === undefined) delete process.env.NEXT_PUBLIC_ANALYTICS_ENABLED;
    else process.env.NEXT_PUBLIC_ANALYTICS_ENABLED = originalAnalytics;
  }
});
