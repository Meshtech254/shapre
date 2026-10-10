import { chromium } from "playwright-core";
import ts from "typescript";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import assert from "node:assert/strict";

// Exercise the capture controller with actual browser MediaStreams, using
// Chromium's synthetic devices so no physical camera or Supabase is required.
const source = await readFile(
  new URL("../src/lib/media/controller.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const server = createServer((_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end("<video autoplay muted playsinline></video>");
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browser;
try {
  browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
    ],
  });
  const context = await browser.newContext({
    permissions: ["camera", "microphone"],
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.addScriptTag({
    content: `window.shapreMedia = (() => { const exports = {}; ${compiled}\nreturn exports; })();`,
  });
  const result = await page.evaluate(async () => {
    const video = document.querySelector("video");
    let snapshot;
    const controller = new window.shapreMedia.MediaController(
      navigator.mediaDevices,
      (value) => {
        snapshot = value;
        if (video.srcObject !== value.stream) video.srcObject = value.stream;
      },
    );
    try {
      await controller.refresh();
      await controller.open();
      await video.play();
      const mic = snapshot.stream.getAudioTracks()[0];
      const oldCamera = snapshot.stream.getVideoTracks()[0];
      controller.toggle("audio");
      await controller.select("video", snapshot.camera);
      await video.play();
      const result = {
        cameraReady: snapshot.cameraState,
        labels: snapshot.devices.every((d) => d.label.length > 0),
        cameraStopped: oldCamera.readyState === "ended",
        micPreserved:
          snapshot.stream.getAudioTracks()[0] === mic &&
          mic.readyState === "live" &&
          !mic.enabled,
        videoWidth: video.videoWidth,
      };
      const tracks = snapshot.stream.getTracks();
      controller.dispose();
      return {
        ...result,
        disposed: tracks.every((t) => t.readyState === "ended"),
      };
    } finally {
      controller.dispose();
    }
  });
  assert.equal(result.cameraReady, "camera ready");
  assert.ok(
    result.labels &&
      result.cameraStopped &&
      result.micPreserved &&
      result.disposed,
  );
  assert.ok(result.videoWidth > 0);
  console.log(
    "Browser media check passed: named inputs, playing raw video, camera replacement, microphone preservation, and cleanup.",
  );
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
