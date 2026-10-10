<p align="center"><img src="public/shapre-logo.svg" alt="Shapre" width="220"></p>

# Shapre

**Shapre is an open-source real-time AI streaming persona platform.** Use a webcam or virtual camera, animate an AI persona, transform its voice, preview the output live, and route a session toward OBS and other streaming workflows. Shapre is designed to be self-hosted; real transformation comes from an inference service you configure.

It brings live webcam transformation, real-time face animation, voice conversion, OBS streaming, and creator controls together for streamers, VTubers, and faceless creators. Actual AI performance depends on the selected models, hardware, and network configuration. Mock mode previews original media and does not perform AI transformation.

> **Consent matters:** Use only faces and voices you own or have explicit permission to use. Do not use Shapre for fraud, unauthorized impersonation, identity deception, or non-consensual cloning.

## Quick start

### Requirements

- Node.js 22 or later and npm 10 or later for the web app.
- Supabase for authentication, database, and private asset storage. A local Supabase stack is optional and uses Docker.
- A separately run inference worker only for real model output. This repository does not include a Python service or model weights; follow the worker's documented Python/runtime requirements.
- No GPU is needed to start the interface in mock mode.

```bash
# Replace OWNER with the GitHub account or organization that owns the repository.
git clone https://github.com/OWNER/shapre.git
cd shapre
npm install
```

Copy `.env.example` to `.env.local`, create a Supabase project, and set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. The service role key must remain server-side. Set `NEXT_PUBLIC_APP_URL=http://localhost:3000` and generate `OUTPUT_TOKEN_SECRET` with at least 32 random bytes. Keep billing and analytics disabled for a self-hosted install.

Apply migrations in `supabase/migrations` in filename order using the Supabase SQL editor or Supabase CLI (`supabase db push`). Configure the Supabase Auth site URL as `http://localhost:3000` and allow `http://localhost:3000/auth/callback`. For email confirmation sessions, use the confirmation URL described in [local development](docs/local-development.md).

Start the web app:

```bash
npm run dev:mock
```

Open http://localhost:3000. Mock mode lets you explore camera selection and the Studio interface without a model or GPU; it does not transform media. For real processing, run a compatible inference service separately and see [inference setup](docs/inference.md) and the [worker contract](docs/inference-contract.md).

### Inference commands

```bash
npm run dev:local   # worker at LOCAL_INFERENCE_API_URL (default http://localhost:8000)
npm run dev:remote  # worker at INFERENCE_API_URL
```

There is no inference API container or Python command in this repository because the worker and model backend are external components. The worker operator chooses its Python version, dependencies, model weights, and hardware according to upstream requirements.

## What Shapre does

- Captures devices exposed through browser MediaDevices, including built-in/USB cameras and OS-recognized virtual cameras.
- Manages private face and optional voice persona assets, consent records, and preparation status.
- Connects Studio sessions to local or remote workers through a model-independent protocol.
- Provides an OBS Browser Source output path for workers that support the output signaling contract.
- Supports mock, local, and remote inference selection; billing and analytics are not needed for core local development.

See [camera setup](docs/cameras), [OBS setup](docs/obs), [self-hosting](docs/self-hosting), and the [repository documentation](docs/local-development.md).

## Project structure

```text
src/app/                 Next.js App Router pages and API routes
src/components/          Studio, persona, admin, and shared UI
src/lib/                 Supabase, auth, inference, media, and streaming logic
supabase/migrations/     Database schema and procedures
supabase/seed/           Demo persona configuration
public/demos/            Demo persona artwork and source assets
scripts/                 Development, seed, and admin utilities
docs/                    Setup, inference protocol, and verification guides
```

The web app and API are in this repository. Inference workers and model weights are separate; no Python inference implementation is present here.

## Development commands

```bash
npm run dev         # use INFERENCE_MODE from .env.local
npm run build       # production Next.js build
npm run lint        # ESLint
npm run typecheck   # TypeScript
npm test            # unit tests
npm run test:smoke  # browser smoke check (Microsoft Edge required)
```

## Self-hosted administrator

Create an account through the app, then run `npm run admin:bootstrap -- YOUR_USER_UUID_OR_EMAIL` once with the Supabase service role key in `.env.local`. The database procedure applies first-owner bootstrap and audit checks; Shapre does not rely on a hardcoded founder email. Review [platform setup](docs/platform-control.md).

## Privacy, safety, and security

Uploads are stored in private Supabase buckets. Review the configured data path and retention behavior of any inference worker before use. Camera/microphone access requires browser permission on localhost or HTTPS. Treat signed OBS output URLs as private access credentials. See [SECURITY.md](SECURITY.md) and the in-app acceptable-use policy.

## Licensing and third-party components

Shapre is intended to be released under the GNU Affero General Public License, version 3 (AGPL-3.0); see [LICENSE](LICENSE). Third-party npm packages retain their own licenses; review their package metadata and notices before distributing a build. No face or voice model weights are bundled. Model projects and weights have separate terms and must be reviewed individually.

The six demo personas are described by the project as original synthetic artwork. Their creation and redistribution provenance should be verified before the repository is made public; remove assets whose origin or license cannot be confirmed. Do not include identifiable real people as default identities.

## GitHub discovery settings

Before publishing, set the GitHub repository description to: “Open-source real-time AI avatar and voice changer for webcam streaming, OBS, VTubing, and self-hosted AI personas.” Suggested topics: `ai-avatar`, `ai-streaming`, `face-swap`, `face-animation`, `webcam`, `obs`, `vtuber`, `virtual-avatar`, `voice-changer`, `voice-conversion`, `voice-cloning`, `realtime-ai`, `live-streaming`, `open-source-ai`, `self-hosted`, `computer-vision`, `generative-ai`.

Set `NEXT_PUBLIC_GITHUB_URL` to the canonical repository URL so website source links point to GitHub. Configure `NEXT_PUBLIC_APP_URL` to the production site origin for canonical metadata and sitemap URLs.

## Before making the repository public

- Confirm the copyright holder and scope of AGPL-3.0 coverage.
- Verify demo artwork provenance and third-party asset licenses; remove uncertain content.
- Run a credential scan over the full Git history after restoring/connecting Git metadata. Rotate the Supabase service-role credential that was previously present in the environment sample, and rotate any other credential that was ever committed.
- Set the canonical website and GitHub URLs, then verify metadata, sitemap, and robots output on the production build.
- Review Supabase policies, Auth redirects, retention, abuse contact, and admin bootstrap for your deployment.
- Run lint, typecheck, tests, production build, and worker integration checks with a clean environment.
- Set repository description/topics, default branch, security contact, and community moderation contacts.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before opening an issue or pull request.
