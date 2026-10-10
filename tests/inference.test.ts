import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { resolveInference } from "../src/lib/inference/config";
import { inferenceTransport } from "../src/lib/inference/transport";
import { sessionSchema } from "../src/lib/inference/protocol";
test("inference mode routes local and remote independently, retaining legacy mock support", () => {
  assert.equal(resolveInference({ INFERENCE_MODE: "mock" }).mode, "mock");
  assert.deepEqual(
    resolveInference({
      INFERENCE_MODE: "local",
      INFERENCE_API_URL: "https://remote.example",
    }),
    { mode: "local", url: "http://localhost:8000" },
  );
  assert.equal(
    resolveInference({
      INFERENCE_MODE: "local",
      LOCAL_INFERENCE_API_URL: "http://localhost:9000",
    }).url,
    "http://localhost:9000",
  );
  assert.equal(
    resolveInference({
      INFERENCE_MODE: "remote",
      INFERENCE_API_URL: "https://remote.example",
    }).url,
    "https://remote.example",
  );
  assert.equal(resolveInference({ INFERENCE_MOCK_MODE: "true" }).mode, "mock");
  assert.equal(
    resolveInference({ INFERENCE_MODE: "local", NODE_ENV: "production" }).mode,
    "remote",
  );
});
test("local worker speaks the shared session protocol and receives auth/settings", async () => {
  let received = "";
  const server = createServer(async (req, res) => {
    assert.equal(req.url, "/v1/sessions");
    assert.equal(req.headers.authorization, "Bearer private-key");
    for await (const part of req) received += part;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        id: "local-1",
        status: "connected",
        realtime: {
          signalingUrl: "http://localhost:8000/publisher",
          token: "scoped",
        },
        output: {
          signalingUrl: "http://localhost:8000/viewer",
          token: "viewer",
        },
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as { port: number };
    const call = inferenceTransport({
      mode: "local",
      url: `http://127.0.0.1:${address.port}`,
      apiKey: "private-key",
    });
    const session = sessionSchema.parse(
      await call("/v1/sessions", "POST", {
        persona_id: "persona-1",
        settings: { faceEnabled: true },
        max_duration_seconds: 60,
        watermark: true,
      }),
    );
    assert.equal(session.id, "local-1");
    assert.equal(session.mock, false);
    assert.equal(JSON.parse(received).settings.faceEnabled, true);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
test("missing or offline inference reports unavailable independently of capture", async () => {
  await assert.rejects(
    inferenceTransport({ mode: "remote" })("/v1/sessions"),
    /raw camera preview/,
  );
  await assert.rejects(
    inferenceTransport({ mode: "local", url: "http://127.0.0.1:1" })(
      "/v1/sessions",
    ),
    /local inference service is unavailable/,
  );
});
