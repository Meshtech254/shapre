# Inference setup

Shapre's repository contains the web application and a model-independent HTTP/WebRTC protocol. It does not contain a Python inference service, model implementation, or model weights. A compatible worker must be run separately and implement [the inference contract](inference-contract.md).

## Modes

- **mock** simulates persona preparation and previews the original camera/microphone media. It performs no face or voice transformation and needs no model or GPU.
- **local** sends server-side requests to a worker at `LOCAL_INFERENCE_API_URL` (default `http://localhost:8000`). Run the worker separately on your machine.
- **remote** connects to `INFERENCE_API_URL`, normally a separately operated GPU service. Use HTTPS in production and keep `INFERENCE_API_KEY` server-only.

Choose with `INFERENCE_MODE=mock|local|remote`, or run `npm run dev:mock`, `npm run dev:local`, or `npm run dev:remote`.

## Hardware and performance

Mock mode needs no inference hardware. For local or remote modes, follow the chosen model's upstream requirements for GPU vendor, VRAM, drivers, runtime, and supported operating system. Some models require a supported GPU and may be unusably slow on CPU. Real-time performance depends on model, resolution, frame rate, hardware, and network latency; Shapre does not guarantee it. Benchmark the complete capture-to-output path before streaming.

No model has been selected or bundled as a default backend. Before adding a model, document its upstream repository, license, redistribution terms, and whether weights are downloaded separately. Do not redistribute weights unless their license explicitly allows it.

## Start the web app

1. Configure Supabase and the variables in `.env.example`.
2. Set `INFERENCE_MODE=mock` and run `npm run dev` to use the interface without a worker.
3. For real inference, run a compatible worker separately, configure its URL and optional API key, then choose local or remote mode.
4. Re-prepare personas when changing workers, then verify transformed output, consent enforcement, latency, OBS connectivity, and stop/revocation behavior.

The browser can use camera and microphone only after permission is granted on localhost or HTTPS. Media is not sent to a worker until a session is started.
