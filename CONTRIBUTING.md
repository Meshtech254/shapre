# Contributing to Shapre

Thanks for helping improve Shapre. Please open an issue before large changes so the scope and approach can be discussed.

## Local setup

Use Node.js 22 or later and npm 10 or later. Copy `.env.example` to `.env.local`, configure a Supabase project, apply the SQL migrations in `supabase/migrations` in order, and set the Supabase Auth redirect URLs. `INFERENCE_MODE=mock` runs the interface without models. See [local development](docs/local-development.md) and [inference setup](docs/inference.md).

## Changes and pull requests

- Create a focused branch from the current default branch; use a descriptive name such as `fix/camera-reconnect` or `docs/self-hosting`.
- Keep pull requests focused. Explain the user impact, implementation, configuration or migration changes, and manual validation performed.
- Link related issues and include screenshots for visible UI changes. Do not include credentials, user media, private URLs, or model weights.
- Preserve privacy, ownership checks, consent enforcement, and server-only secret boundaries.

## Issues

Use the issue templates. Include the Shapre version/commit, browser and operating system, inference mode, relevant sanitized logs, reproduction steps, and expected behavior. Never attach secrets or identifiable face/voice media.

## Code conventions and checks

Follow the existing TypeScript, React, and Next.js patterns. Keep API validation and authorization server-side, prefer shared utilities to duplicate logic, and document new environment variables and worker protocol changes.

Run before submitting:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Add or update tests when changing behavior. Supabase, camera, worker, and OBS paths may also need the manual checks in `docs/local-development.md`.
