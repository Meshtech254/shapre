export type InferenceMode = "mock" | "local" | "remote";
export function resolveInference(config: {
  INFERENCE_MODE?: InferenceMode;
  INFERENCE_MOCK_MODE?: string;
  LOCAL_INFERENCE_API_URL?: string;
  INFERENCE_API_URL?: string;
  NODE_ENV?: string;
}) {
  const requested =
    config.INFERENCE_MODE ??
    (config.INFERENCE_MOCK_MODE === "true" ? "mock" : "remote");
  // Keep development emulation and localhost workers out of production builds.
  const mode: InferenceMode =
    config.NODE_ENV === "production" ? "remote" : requested;
  return {
    mode,
    url:
      mode === "local"
        ? (config.LOCAL_INFERENCE_API_URL ?? "http://localhost:8000")
        : mode === "remote"
          ? config.INFERENCE_API_URL
          : undefined,
  };
}
