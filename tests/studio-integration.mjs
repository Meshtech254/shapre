import { chromium } from "playwright-core";
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
const { createClient } = require("@supabase/supabase-js");
const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } },
);
const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
if (process.env.INFERENCE_MODE !== "mock")
  throw new Error("This acceptance test requires INFERENCE_MODE=mock.");
const email = `shapre-qa-${crypto.randomUUID()}@example.invalid`,
  password = `QA-${crypto.randomUUID()}-9a!`;
let userId, browser;
let cleanupFailed = false;
const evidence = { consoleErrors: [], failedRequests: [] };
async function request(page, path, body) {
  return page.evaluate(
    async ({ path, body }) => {
      const r = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return { status: r.status, data: await r.json() };
    },
    { path, body },
  );
}
try {
  const created = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "Shapre QA" },
  });
  if (created.error) throw created.error;
  userId = created.data.user.id;
  browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    args: [
      "--use-fake-device-for-media-stream=fps=30",
      "--use-fake-ui-for-media-stream",
    ],
  });
  const context = await browser.newContext({
      permissions: ["camera", "microphone"],
      viewport: { width: 1500, height: 1100 },
    }),
    page = await context.newPage();
  await context.addInitScript(() => {
    window.qaBeacons = [];
    const beacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (...args) => {
      window.qaBeacons.push({ url: String(args[0]), stack: new Error().stack });
      return beacon(...args);
    };
  });
  page.setDefaultTimeout(45000);
  // Compile the signed output routes before capture: a cold Next dev build can
  // refresh Studio while the new output page is first compiled.
  const warmId = "00000000-0000-4000-8000-000000000099";
  const warmOutput = await context.newPage();
  await warmOutput.goto(`${base}/studio/output/${warmId}?token=warm-up`);
  await warmOutput.locator(".output-state").waitFor();
  await warmOutput.close();
  page.on("console", (message) => {
    if (message.text().includes("Fast Refresh")) {
      evidence.refreshMessages ??= [];
      evidence.refreshMessages.push(message.text());
    }
  });
  page.on("pageerror", (e) => evidence.consoleErrors.push(e.message));
  page.on("requestfailed", (r) =>
    evidence.failedRequests.push(new URL(r.url()).pathname),
  );
  await page.goto(`${base}/login`);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await page.waitForURL("**/dashboard", { timeout: 60000 });
  await page.goto(`${base}/demo-personas/atlas`);
  await page.getByText("Available · Mock", { exact: true }).waitFor();
  await page.getByRole("link", { name: "Try in Studio", exact: true }).click();
  await page
    .getByRole("button", { name: "Enable camera & mic", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelector("video")?.videoWidth > 0,
  );
  await page.waitForFunction(
    () =>
      document.querySelector('select[aria-label="Camera"]')?.options.length >
        1 &&
      document.querySelector('select[aria-label="Microphone"]')?.options
        .length > 1,
  );
  evidence.camera = true;
  evidence.microphone = true;
  evidence.selectedAvatar = await page
    .locator(".studio-panel img")
    .evaluate((img) => img.complete && img.naturalWidth > 0);
  const forbidden = await request(page, "/api/admin/test-mode", {
    enabled: true,
  });
  assert.equal(forbidden.status, 403);
  evidence.adminDenied = true;
  const post = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/v1/sessions" &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Start Trial", exact: true }).click();
  const started = await post;
  const session = await started.json();
  assert.equal(started.status(), 200, session.error);
  evidence.trialStarted = true;
  await page.getByRole("button", { name: "Stop Live", exact: true }).waitFor();
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("link", { name: /Open output preview/ }).click();
  const output = await popupPromise;
  output.setDefaultTimeout(45000);
  try {
    await output.waitForFunction(
      () => document.querySelector("video")?.videoWidth > 0,
    );
  } catch (error) {
    evidence.outputFailure = {
      studio: await page.evaluate(() => ({
        url: location.href,
        beacons: window.qaBeacons,
        text: document.body.innerText.slice(-1800),
      })),
      output: await output.evaluate(() => ({
        url: location.pathname,
        text: document.body.innerText,
      })),
    };
    console.log("Output diagnostics", JSON.stringify(evidence.outputFailure));
    throw error;
  }
  assert.equal(await output.locator(".sidebar").count(), 0);
  evidence.outputBridge = true;
  await page.waitForTimeout(1500);
  const stopResponse = page.waitForResponse((r) =>
    r.url().includes(`/sessions/${session.sessionId}/stop`),
  );
  await page.getByRole("button", { name: "Stop Live", exact: true }).click();
  const stopped = await stopResponse;
  assert.equal(stopped.status(), 200, (await stopped.json()).error);
  await page
    .getByRole("button", { name: "Start Trial", exact: true })
    .waitFor();
  evidence.trialStopped = true;
  assert.ok(await page.locator("video").evaluate((v) => v.videoWidth > 0));
  evidence.rawPreviewPreserved = true;
  const revoked = await output.evaluate(
    async (path) => (await fetch(path)).status,
    `/api/v1/output/${session.sessionId}?token=${new URL(session.outputUrl).searchParams.get("token")}`,
  );
  assert.equal(revoked, 410);
  evidence.outputRevoked = true;
  await output.close();
  const repeat = await request(page, "/api/v1/sessions", {
    demoPersonaSlug: "atlas",
    settings: { quality: "Balanced", faceEnabled: true, voiceEnabled: false },
  });
  assert.equal(repeat.status, 409);
  evidence.trialLimit = true;
  const persona = await request(page, "/api/v1/personas", {
    name: "QA original persona",
    description: "Temporary synthetic test identity",
    consentFace: true,
    consentVoice: false,
  });
  assert.equal(persona.status, 200, persona.data.error);
  const bytes = await readFile("public/demos/amara/face-source.jpg");
  const upload = await request(
    page,
    `/api/v1/personas/${persona.data.id}/upload`,
    {
      kind: "face",
      filename: "qa-source.jpg",
      mime: "image/jpeg",
      size: bytes.length,
      consent: true,
    },
  );
  assert.equal(upload.status, 200, upload.data.error);
  const uploaded = await anon.storage
    .from(upload.data.bucket)
    .uploadToSignedUrl(upload.data.path, upload.data.token, bytes, {
      contentType: "image/jpeg",
    });
  if (uploaded.error) throw uploaded.error;
  const completed = await request(
    page,
    `/api/v1/personas/${persona.data.id}/asset`,
    { kind: "face", assetId: upload.data.assetId, operation: "complete" },
  );
  assert.equal(completed.status, 200, completed.data.error);
  const prepared = await request(
    page,
    `/api/v1/personas/${persona.data.id}/prepare`,
    { kind: "face" },
  );
  assert.equal(prepared.status, 200, prepared.data.error);
  evidence.personaPrepared = true;
  await page.goto(`${base}/studio?persona=${persona.data.id}`);
  await page
    .getByRole("button", { name: "Enable camera & mic", exact: true })
    .click();
  try {
    await page.waitForFunction(
      () => document.querySelector("video")?.videoWidth > 0,
    );
  } catch (error) {
    evidence.customCaptureFailure = await page.evaluate(() => ({
      text: document.body.innerText.slice(-2500),
      beacons: window.qaBeacons,
    }));
    console.log(
      "Custom capture diagnostics",
      JSON.stringify(evidence.customCaptureFailure),
    );
    throw error;
  }
  const liveResponse = page.waitForResponse(
    (r) =>
      new URL(r.url()).pathname === "/api/v1/sessions" &&
      r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Start Live", exact: true }).click();
  const live = await liveResponse;
  assert.equal(live.status(), 200, (await live.json()).error);
  evidence.liveStarted = true;
  await page.waitForTimeout(1200);
  const liveStop = page.waitForResponse((r) =>
    /\/sessions\/[^/]+\/stop$/.test(new URL(r.url()).pathname),
  );
  await page.getByRole("button", { name: "Stop Live", exact: true }).click();
  assert.equal((await liveStop).status(), 200);
  evidence.liveStopped = true;
  const usage = await service
    .from("usage_events")
    .select("quantity")
    .eq("user_id", userId);
  assert.ok(usage.data?.length);
  evidence.usageRecorded = true;
  const analytics = await service
    .from("demo_analytics")
    .select("event")
    .eq("user_id", userId);
  evidence.analytics = (analytics.data ?? []).map((x) => x.event);
  assert.ok(evidence.analytics.includes("demo_trial_completed"));
  const eventsBefore = evidence.analytics.length;
  await page.waitForTimeout(3000);
  const idle = await service
    .from("demo_analytics")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  assert.equal(idle.count, eventsBefore);
  evidence.idleAnalyticsStable = true;
  assert.deepEqual(evidence.consoleErrors, []);
  await mkdir("test-results", { recursive: true });
  await page.screenshot({
    path: "test-results/studio-authenticated.png",
    fullPage: true,
  });
} finally {
  await browser?.close();
  if (userId) {
    const faces = await service.storage.from("persona-faces").list(userId);
    for (const folder of faces.data ?? []) {
      const files = await service.storage
        .from("persona-faces")
        .list(`${userId}/${folder.name}`);
      if (files.data?.length)
        await service.storage
          .from("persona-faces")
          .remove(files.data.map((f) => `${userId}/${folder.name}/${f.name}`));
    }
    const sessions = await service
      .from("live_sessions")
      .select("id")
      .eq("user_id", userId)
      .in("status", ["initializing", "connected", "live"]);
    for (const s of sessions.data ?? [])
      await service.rpc("finish_session", { session_id: s.id });
    const deleted = await service.auth.admin.deleteUser(userId);
    cleanupFailed = !!deleted.error;
  }
  await mkdir("test-results", { recursive: true });
  await writeFile(
    "test-results/studio-integration.json",
    JSON.stringify(evidence, null, 2),
  );
}
if (cleanupFailed) throw new Error("Temporary QA account cleanup failed.");
console.log(
  "Authenticated Studio acceptance passed:",
  JSON.stringify(evidence),
);
