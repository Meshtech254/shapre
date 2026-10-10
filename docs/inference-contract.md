# Realtime inference contract

Local and remote workers implement the same HTTP and WebRTC protocol. `INFERENCE_MODE=local` sends server-to-server requests to `LOCAL_INFERENCE_API_URL` (default `http://localhost:8000`); `remote` uses `INFERENCE_API_URL`. Both modes send `Authorization: Bearer INFERENCE_API_KEY` when that optional key is configured. Use HTTPS in production. Requests time out after 15 seconds. Model preparation and media processing run on the worker, which can use local CPU/GPU resources or remote GPUs. The frontend has no model SDK or model-specific payloads; experiments can replace face tracking, reenactment, identity transformation, and voice conversion behind this contract. `mock` uses the existing simulated preparation and original-media bridge instead of HTTP inference.

## Preparation

`POST /v1/personas/{id}/face/prepare` and `/voice/prepare` receive `{ assets: [{ id, url }] }`. URLs are private Supabase capabilities valid for 15 minutes. Fetch assets before expiry and keep derivative assets scoped to this persona. Return `{ status: "processing" | "ready" | "failed" }`. For asynchronous jobs implement `GET /v1/personas/{id}/status` returning `{ face_status, voice_status }`; the application polls when a persona is processing. Only return ready once the asset is usable.

## Sessions

`POST /v1/sessions` receives `{ persona_id, settings, max_duration_seconds, watermark }`.

```json
{
  "id": "external-session-id",
  "status": "connected",
  "mock": false,
  "realtime": {
    "signalingUrl": "https://gpu.example/signaling/publisher",
    "token": "short-lived-publisher-token",
    "iceServers": [{ "urls": "stun:stun.example:3478" }]
  },
  "output": {
    "signalingUrl": "https://gpu.example/signaling/viewer",
    "token": "short-lived-read-only-viewer-token",
    "iceServers": []
  }
}
```

The browser sends its fully gathered SDP offer to the signaling URL as JSON `{ type: "offer", sdp: "..." }` with the scoped session token in Authorization. The service responds with `{ type: "answer", sdp: "..." }`. Configure CORS for the web app origin and handle OPTIONS. Publisher transceivers reserve video and audio; a microphone may initially be absent. Camera/microphone switches use RTCRtpSender.replaceTrack, including temporarily detaching a removed device. Workers must tolerate track changes without creating a new session. Publisher tracks carry the selected camera and microphone. Output is receive-only. Provide TURN for networks that require it. Only return transformed tracks to the publisher/output; the app does not manufacture transformed media. Revoke all connections and scoped tokens on stop.

`GET /v1/sessions/{id}` returns the same session shape and optional `latency_ms`. `POST /v1/sessions/{id}/stop` terminates media/compute and is idempotent. Production responses must not return `mock: true`.

Settings include `faceEnabled`, `voiceEnabled`, `smoothing` 0–100, `expression` 0–100, `quality` (Low Latency/Balanced/High Quality), `similarity` 0–100, `pitch` −12…12, `stability` 0–100, and `noiseReduction`. Reject unsupported options explicitly. Enforce the duration budget on the GPU service. Apply `watermark` to real output, including viewers. Do not silently ignore consent or moderation restrictions.

`DELETE /v1/personas/{id}` must idempotently remove derivative persona data and cancel preparation jobs. The application calls this before removing original assets when an inference service is configured, and retains the persona if external deletion fails so the user can retry. The provider must implement this path before production processing is enabled.

## Local worker integration

Use the same paths above on localhost:8000. The Next.js server calls preparation/session endpoints; the browser and OBS directly call the returned signaling URLs. Return localhost URLs only when Studio and OBS run on the worker machine. Set CORS to allow http://localhost:3000, including OPTIONS, JSON Content-Type and Authorization. Remote HTTPS pages require secure signaling URLs. ICE/TURN requirements still apply to WebRTC even when control endpoints are HTTP.

Return real transformed video/audio only when your chosen models are loaded and preparation has succeeded. Return a failure/unavailable status for absent models rather than declaring simulated identities ready. A passthrough debugging worker must be clearly identified by the developer; the application mock mode already provides original-media previews. The output connection must have its own receive-only token and support multiple viewers. Stop must revoke both Studio and OBS connections and enforce max_duration_seconds. Local and remote share validation and usage accounting.

Shared schemas live in src/lib/inference/protocol.ts; the deployment selector is config.ts and HTTP transport is transport.ts. Browser capture is owned by src/lib/media/controller.ts and remains operational if any worker call fails.

## Shared demo identities

Demo sessions add `identity: { kind: "demo", face_asset_reference, voice_asset_reference }` alongside `persona_id` (demo UUID). Resolve these server-configured, Shapre-owned assets in the worker rather than expecting user uploads. No voice reference means normal microphone passthrough when voiceEnabled=false. Reject missing/unlicensed assets. Demo trials receive max_duration_seconds=60 and watermark=true; enforce both at the worker and revoke connections on completion. Frontend preview-only concepts cannot create sessions.

Avatar-enabled demos may also send identity.avatar_url and identity.face_source_reference as absolute URLs, alongside the prepared face_asset_reference. These are identity-consistent avatar/source images; their presence alone never indicates a prepared face model. Use the source for preparation in advance, retain the matching demo UUID, and return actual transformed output only after preparation succeeds. Private model references remain server-side.
