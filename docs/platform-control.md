# Studio stability and platform controls

Apply migrations **001 → 002 → 003 → 004 → 005** in the Supabase SQL editor. If 004 is already applied, run only 005; it refreshes procedures without recreating tables or overwriting settings. Migration 004 adds private role, entitlement, credit-account, settings and audit tables. Browser credentials cannot write these tables or invoke privileged procedures. The API authenticates the actual Supabase user, checks origin and role, validates changes, and writes changes and their audit record in one transaction. Admins can manage demos; super admins can change limits, pricing, credits, user roles and overrides, reset trials and stop sessions. The final super admin cannot be demoted.

After signing up, bootstrap the founder once:

```powershell
npm run admin:bootstrap -- YOUR_USER_UUID_OR_SIGN_IN_EMAIL
npm run dev:mock
```

The bootstrap uses the locally configured service credentials and records an audit entry. It refuses to assign another initial founder once one exists. No email address is embedded in authorization logic. Visit `/admin` to manage the platform. Credit adjustments require a reason; credits represent **additional streaming minutes**, not currency or purchased monetary credit. Pricing configuration changes display prices; checkout remains unconfigured.

The founder receives unlimited credit/streaming/persona entitlements, trial bypass, all quality modes and preview-feature access. Overrides take precedence over these defaults and have optional activation/expiry dates. `Test as normal user` applies ordinary limits for one hour without changing the account's role or admin authorization. The cookie is server-set and HTTP-only; the policy procedure accepts simulation only for real admin roles. Stop the current session before changing test mode. Security throttles always remain enabled.

## Avatar usability and inference

In `INFERENCE_MODE=mock`, the six bundled avatars display **Available · Mock** and Start Trial creates a real, capped development session. Output is the original camera/microphone with an explicit mock label. Model readiness flags stay honest. The founder can use Start Live without the trial paywall.

In local/remote mode, upload or assign a face source in `/admin/demo-personas`, then prepare it with the configured worker. The worker preparation endpoint can return `{status: "ready", asset_reference: "worker-artifact-id"}`. If it omits the reference, its prepared persona UUID is used. A worker returning `processing` needs its completed artifact assigned once preparation finishes. Enable face/inference readiness only after validating transformed output. Voice conversion requires a separate voice artifact. Artwork alone cannot perform face reenactment; no face or voice model weights are bundled.

The selected Studio avatar is priority-loaded, while offscreen grid thumbnails remain lazy. Capture uses direct MediaStreams, independent input tracks, browser device enumeration and devicechange events. Unsupported video dimensions/frame rate fall back to the same selected device with unconstrained dimensions. Media permission and hardware availability still belong to the browser.

## Session and usage rules

Session creation locks the account and atomically checks readiness, trial eligibility, quality, concurrent-session cap and credit allowance. Client operation locks prevent accidental double clicks; database reservations enforce the rules across tabs. Worker max duration and watermark match the server reservation. Failed setup releases reserved credits and an unused trial. Stop finalizes once even when the worker is unreachable. Monthly allowance and extra credits are reserved across concurrent sessions; unused credit is returned on finalization. Quality multipliers affect usage. Unrestricted sessions have a 24-hour technical lease, renewed by starting a new session, without a normal trial or credit paywall.

Only active sessions send intentional heartbeat/status traffic. Two minutes without a publisher heartbeat makes a session stale. `npm run dev`, `dev:mock`, `dev:local` and `dev:remote` launch a cleanup helper that finalizes abandoned sessions and attempts to stop their workers. For a production deployment schedule `npm run sessions:reap` every minute using server credentials. If Supabase already has pg_cron provisioned, migration 004 schedules database finalization automatically; the worker must still enforce its supplied max duration. `npm run sessions:reap -- --watch` runs the worker cleanup loop separately. Keep service credentials on the server.

The signed `/studio/output/[sessionId]` route has no app navigation. Real worker output connects through the generic WebRTC interface. Development mock output uses a local WebRTC bridge between tabs of the same browser. OBS runs a separate browser and cannot receive that bridge; use a local/remote worker exposing the output WebRTC endpoint for actual OBS Browser Source streaming. Do not describe the local bridge as cross-browser broadcast.

## Analytics and verification

Migration 001 omitted demo-analytics from supported rate-limit actions, causing every event to be rejected with 429. Migration 004 corrects the allowlist and makes rate caps server-owned. Analytics deduplicates events in memory across batch flushes/remounts, sends a bounded batch only for actions, respects Retry-After and never retries failed telemetry. Started/completed events are emitted once by server session lifecycle code. Analytics failure cannot gate Studio. The favicon matches the existing lime standalone mark, with PNG and ICO paths.

Run `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:media` and `npm run test:studio`. Tests apply all five migrations inside an isolated PostgreSQL engine and exercise founder policy, normal-user simulation, direct permission denial, rate limiting, trial reservation/retry/completion, credit reservation/refund, audit writes and stale-session cleanup. The Studio fixture checks media, avatar loading, idle requests and rendering. `npm run test:integration` additionally uses the real running app and Supabase, creates a temporary normal QA account, checks demo/custom start/stop, avatar decoding, output revocation, trial limits and upload/preparation, then deletes its files and account. Physical cameras/Iriun, real worker transformation and OBS require the corresponding local hardware/worker acceptance run. These fixtures do not fabricate hardware or model availability.

Recorded fixture verification: 31 unit/PostgreSQL tests passed; synthetic browser camera/microphone checks passed. The latest Studio fixture observed 30 FPS idle playback, raw preview in 505 ms, zero dropped frames/idle long tasks, stable parent renders and attachments, one recovery request and one batched analytics request while idle. Double-clicking Start created one mock session, another tab received live video, and Stop preserved the raw camera and ended output. Signaling descriptions are serialized to plain JSON before BroadcastChannel transport. These are regression measurements from synthetic devices, not physical hardware or GPU output.

Live acceptance passed after migration 005: sign-in, avatar loading, camera/microphone selection, normal-user admin denial, trial Start/Stop, same-browser mock output, output revocation, repeat-trial rejection, custom face upload/preparation, custom live Start/Stop, usage recording and stable idle analytics. The temporary QA account and files were removed. No browser JavaScript errors occurred; canceled navigation/prefetch requests were recorded separately. Physical devices and real model transformation still require hardware/worker testing.

Media and session effect cleanup waits one microtask to distinguish React Strict Mode effect replay from actually leaving Studio. Replay preserves camera tracks and the active session; actual unmount releases resources. The capture button stays disabled until the media controller has initialized. Development output routes are loaded before acceptance capture to avoid cold compilation interference. Mock, local and remote development build directories are isolated, as is the production build, so running local and mock servers together does not corrupt Next.js artifacts. Production runtime enforces remote inference.
