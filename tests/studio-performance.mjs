import { build } from "esbuild";
import { chromium } from "playwright-core";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import assert from "node:assert/strict";
const seed = JSON.stringify(
  JSON.parse(await readFile("supabase/seed/demo-personas.json", "utf8")).map(
    (p) => ({
      ...p,
      mock_available: p.active && p.metadata.avatar_ready === true,
    }),
  ),
);
const mocks = {
  "next/link": `import React from 'react';export default function Link({href,children,...props}){return <a href={href} {...props}>{children}</a>}`,
  "next/image": `import React from 'react';export default function Image({fill,priority,unoptimized,sizes,...props}){return <img {...props}/>}`,
  "next/dynamic": `import React from 'react';export default function dynamic(fn){const C=React.lazy(()=>fn().then(m=>({default:m.default??m})));return props=><React.Suspense fallback={null}><C {...props}/></React.Suspense>}`,
  "next/navigation": `export function useRouter(){return {refresh(){},push(){}}}`,
};
const bundle = await build({
  stdin: {
    contents: `import React,{Profiler} from 'react';import{createRoot}from'react-dom/client';import{Studio}from'./src/components/studio/studio';import{Output}from'./src/components/studio/output';import{DemoLibrary}from'./src/components/demo-personas/library';window.commits=[];window.mountOutput=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<Output id="00000000-0000-4000-8000-000000000099" token="fixture"/>)};window.mountLibrary=()=>{window.root=createRoot(document.getElementById("root"));window.root.render(<DemoLibrary personas={${seed}} />)};window.mountStudio=()=>{window.root=createRoot(document.getElementById('root'));window.root.render(<Profiler id="Studio" onRender={(id,phase,actualDuration)=>window.commits.push({phase,actualDuration})}><Studio personas={[]} demos={${seed}} mock={true} urls={{}} deviceDefaults={{}}/></Profiler>);}`,
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  jsx: "automatic",
  bundle: true,
  write: false,
  platform: "browser",
  define: { "process.env.NODE_ENV": '"development"' },
  plugins: [
    {
      name: "fixture",
      setup(b) {
        b.onResolve(
          { filter: /^next\/(link|image|dynamic|navigation)$/ },
          (a) => ({
            path: a.path,
            namespace: "fixture",
          }),
        );
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
          contents: mocks[a.path],
          loader: "jsx",
          resolveDir: process.cwd(),
        }));
      },
    },
  ],
});
const css = await readFile("src/app/globals.css", "utf8");
let active = false;
let starts = 0;
const sessionId = "00000000-0000-4000-8000-000000000099";
const server = createServer(async (req, res) => {
  if (req.url === "/bundle.js") {
    res.setHeader("Content-Type", "text/javascript");
    res.end(bundle.outputFiles[0].text);
  } else if (req.url === "/api/v1/sessions") {
    res.setHeader("Content-Type", "application/json");
    if (req.method === "POST") {
      starts++;
      active = true;
      res.end(
        JSON.stringify({
          sessionId,
          inference: { id: "mock-fixture", status: "connected", mock: true },
          outputUrl: `http://127.0.0.1:${server.address().port}/?output=1`,
          watermark: true,
          trial: true,
          expiresAt: new Date(Date.now() + 120000).toISOString(),
        }),
      );
    } else {
      await new Promise((r) => setTimeout(r, 2000));
      res.end("null");
    }
  } else if (req.url?.startsWith(`/api/v1/sessions/${sessionId}`)) {
    if (req.method === "POST") active = false;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({ ok: true, status: active ? "connected" : "stopped" }),
    );
  } else if (req.url?.startsWith(`/api/v1/output/${sessionId}`)) {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = active ? 200 : 410;
    res.end(
      JSON.stringify(
        active
          ? { mock: true, status: "connected", watermark: true }
          : { error: "Session is offline." },
      ),
    );
  } else if (req.url?.startsWith("/api/v1/demo-analytics")) {
    res.setHeader("Content-Type", "application/json");
    res.end("{}");
  } else if (req.url?.startsWith("/demos/")) {
    res.setHeader(
      "Content-Type",
      req.url.endsWith(".webp") ? "image/webp" : "image/jpeg",
    );
    res.end(await readFile("public" + req.url));
  } else {
    res.setHeader("Content-Type", "text/html");
    res.end(
      `<style>${css}</style><div id="root"></div><script src="/bundle.js"></script>`,
    );
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
let browser;
try {
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
  });
  const page = await context.newPage();
  await context.addInitScript(() => {
    const Base = window.RTCPeerConnection;
    window.fixturePeers = [];
    window.RTCPeerConnection = class extends Base {
      constructor(...args) {
        super(...args);
        window.fixturePeers.push(this);
      }
    };
  });
  const errors = [];
  page.on("pageerror", (e) => {
    errors.push(e.message);
    console.error(e.message);
  });
  const requests = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/")) requests.push(r.url().split("/api/")[1]);
  });
  await page.addInitScript(() => {
    window.captures = [];
    window.attachments = 0;
    const d = Object.getOwnPropertyDescriptor(
      HTMLMediaElement.prototype,
      "srcObject",
    );
    Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
      ...d,
      set(v) {
        if (v) window.attachments++;
        d.set.call(this, v);
      },
    });
    const capture = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (c) => {
      const s = await capture(c);
      window.captures.push(s);
      return s;
    };
    window.longTasks = [];
    new PerformanceObserver((l) =>
      window.longTasks.push(
        ...l
          .getEntries()
          .map((e) => ({ duration: e.duration, startTime: e.startTime })),
      ),
    ).observe({ type: "longtask", buffered: true });
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.start");
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.evaluate(() => window.mountStudio());
  const enable = page.getByRole("button", { name: "Enable camera & mic" });
  await enable.waitFor();
  const blocked = await enable.isDisabled();
  const started = Date.now();
  await enable.click();
  await page.waitForFunction(
    () => document.querySelector("video")?.videoWidth > 0,
  );
  const previewMs = Date.now() - started;
  await page.waitForTimeout(2500);
  const videoIdentity = await page.evaluate(() => {
    window.originalVideo = document.querySelector("video");
    return window.attachments;
  });
  const micId = await page.evaluate(
    () =>
      window.captures
        .flatMap((s) => s.getAudioTracks())
        .find((t) => t.readyState === "live")?.id,
  );
  const camera = page.getByLabel("Camera", { exact: true });
  const mic = page.getByLabel("Microphone", { exact: true });
  const cameraId = await camera.inputValue();
  await camera.selectOption("");
  await page.waitForTimeout(500);
  await camera.selectOption(cameraId);
  await page.waitForTimeout(500);
  const micPreserved = await page.evaluate(
    (id) =>
      window.captures
        .flatMap((s) => s.getAudioTracks())
        .some((t) => t.id === id && t.readyState === "live"),
    micId,
  );
  const microphoneId = await mic.inputValue();
  await mic.selectOption("");
  await page.waitForTimeout(500);
  await mic.selectOption(microphoneId);
  await page.waitForTimeout(500);
  const selector = page.getByRole("combobox", { name: "Select persona" });
  for (const slug of ["nova", "amara", "pixel", "hana", "atlas"]) {
    await selector.selectOption("demo:" + slug);
    await page.waitForTimeout(100);
  }
  assert.ok(
    !(await page.getByRole("button", { name: "Start Trial" }).isDisabled()),
  );
  await page.waitForTimeout(1200);
  const requestsBeforeIdle = requests.length;
  const stable = await page.evaluate(() => ({
    time: performance.now(),
    frames: document.querySelector("video").getVideoPlaybackQuality()
      .totalVideoFrames,
    renders: document
      .querySelector("details")
      ?.textContent?.match(/Studio renders (\d+)/)?.[1],
    attachments: window.attachments,
    commits: window.commits.length,
  }));
  await page.waitForTimeout(2200);
  assert.equal(
    requests.length,
    requestsBeforeIdle,
    "Idle Studio must not send analytics or metadata requests.",
  );
  const stats = await page.evaluate(() => ({
    time: performance.now(),
    attachments: window.attachments,
    commits: window.commits.length,
    videoSame: window.originalVideo === document.querySelector("video"),
    frames: document.querySelector("video").getVideoPlaybackQuality()
      .totalVideoFrames,
    longTasks: window.longTasks,
    renderMs: window.commits.reduce((n, c) => n + c.actualDuration, 0),
    parentRenders: document
      .querySelector("details")
      ?.textContent?.match(/Studio renders (\d+)/)?.[1],
    diagnostics: document.querySelector("details")?.textContent,
  }));
  stats.observedFps = Math.round(
    ((stats.frames - stable.frames) * 1000) / (stats.time - stable.time),
  );
  stats.idleLongTasks = stats.longTasks.filter(
    (task) => task.startTime >= stable.time,
  );
  await mkdir("test-results", { recursive: true });
  await writeFile(
    "test-results/studio.cpuprofile",
    JSON.stringify((await cdp.send("Profiler.stop")).profile),
  );
  await page.screenshot({
    path: "test-results/studio-demos.png",
    fullPage: true,
  });
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((b) =>
      b.textContent.includes("Start Trial"),
    );
    button.click();
    button.click();
  });
  await page.getByRole("button", { name: "Stop Live", exact: true }).waitFor();
  assert.equal(starts, 1, "Double start must create one session.");
  const outputTab = await context.newPage();
  await outputTab.goto(`http://127.0.0.1:${server.address().port}/?output=1`);
  await outputTab.evaluate(() => window.mountOutput());
  try {
    await outputTab.waitForFunction(
      () => document.querySelector("video")?.videoWidth > 0,
      {},
      { timeout: 15000 },
    );
  } catch (error) {
    for (const tab of [page, outputTab])
      console.log(
        "Bridge diagnostics",
        await tab.evaluate(() => ({
          peers: window.fixturePeers?.map((p) => ({
            state: p.connectionState,
            ice: p.iceConnectionState,
            signaling: p.signalingState,
            senders: p.getSenders().map((s) => s.track?.kind),
            receivers: p.getReceivers().map((r) => r.track?.kind),
          })),
          video: {
            paused: document.querySelector("video")?.paused,
            muted: document.querySelector("video")?.muted,
            tracks: document
              .querySelector("video")
              ?.srcObject?.getTracks()
              .map((t) => ({ kind: t.kind, state: t.readyState })),
          },
          text: document.body.innerText.slice(-400),
        })),
      );
    throw error;
  }
  const mockOutput = true;
  await page.getByRole("button", { name: "Stop Live", exact: true }).click();
  await page
    .getByRole("button", { name: "Start Trial", exact: true })
    .waitFor();
  assert.equal(active, false);
  assert.ok(await page.locator("video").evaluate((v) => v.videoWidth > 0));
  await outputTab.waitForFunction(() => !document.querySelector("video"));
  await outputTab.close();
  await page.evaluate(() => window.root.unmount());
  const cleanup = await page.evaluate(() =>
    window.captures.every((s) =>
      s.getTracks().every((t) => t.readyState === "ended"),
    ),
  );
  stats.mockOutput = mockOutput;
  const barePreview = await page.evaluate(async () => {
    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.style.width = "960px";
    document.getElementById("root").append(video);
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30, max: 30 },
      },
      audio: false,
    });
    try {
      video.srcObject = stream;
      await video.play();
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const frames = video.getVideoPlaybackQuality().totalVideoFrames,
        start = performance.now();
      await new Promise((resolve) => setTimeout(resolve, 2200));
      return {
        fps: Math.round(
          ((video.getVideoPlaybackQuality().totalVideoFrames - frames) * 1000) /
            (performance.now() - start),
        ),
        settings: stream.getVideoTracks()[0].getSettings(),
      };
    } finally {
      stream.getTracks().forEach((track) => track.stop());
      video.remove();
    }
  });
  await page.evaluate(() => window.mountLibrary());
  await page.getByRole("heading", { name: "Try a Demo Persona" }).waitFor();
  assert.equal(await page.locator(".demo-card").count(), 6);
  const avatarSources = await page
    .locator(".demo-card img")
    .evaluateAll((images) => images.map((img) => img.getAttribute("src")));
  assert.ok(avatarSources.every((src) => src.endsWith("/thumbnail.webp")));
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".demo-card img")].every(
      (img) => img.complete && img.naturalWidth > 0,
    ),
  );
  await page.screenshot({
    path: "test-results/avatar-library.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Cyborg", exact: true }).click();
  assert.equal(await page.locator(".demo-card").count(), 2);
  assert.equal(
    await page.getByText("Shapre Demo Persona", { exact: true }).count(),
    2,
  );
  await page.screenshot({
    path: "test-results/demo-library.png",
    fullPage: true,
  });
  await page.evaluate(() => window.root.unmount());
  const result = {
    blocked,
    barePreview,
    previewMs,
    videoIdentity,
    micPreserved,
    stable,
    stats,
    requests,
    cleanup,
    errors,
  };
  await writeFile(
    "test-results/studio-performance.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
  assert.equal(blocked, false);
  assert.ok(micPreserved && stats.videoSame && cleanup);
  assert.equal(stats.attachments, stable.attachments);
  assert.equal(stats.parentRenders, stable.renders);
  assert.ok(stats.commits - stable.commits <= 6);
  assert.equal(requests.filter((p) => p === "v1/sessions").length, 2);
  assert.equal(errors.length, 0);
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
