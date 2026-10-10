import type { InferenceMode } from "./config";
/** Both worker deployments implement the same model-independent HTTP protocol. */
export function inferenceTransport(config: {
  mode: InferenceMode;
  url?: string;
  apiKey?: string;
}) {
  return async (path: string, method = "POST", body?: unknown) => {
    if (!config.url)
      throw new Error(
        "Inference unavailable. Configure a local or remote inference service. Your raw camera preview is still available.",
      );
    try {
      const response = await fetch(`${config.url.replace(/\/$/, "")}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(config.apiKey
            ? { Authorization: `Bearer ${config.apiKey}` }
            : {}),
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok)
        throw new Error(`Worker returned HTTP ${response.status}.`);
      if (response.status === 204) return {};
      const text = await response.text();
      return text ? JSON.parse(text) : {};
    } catch {
      throw new Error(
        `The ${config.mode} inference service is unavailable or returned an invalid response. Check the worker and retry. Your raw camera preview is still available.`,
      );
    }
  };
}
