import { studioMetrics } from "@/lib/streaming/diagnostics";
const pending = new Map<string, Promise<unknown>>();
export function api<T>(path: string, options?: RequestInit): Promise<T> {
  const get = !options?.method || options.method === "GET";
  if (get && pending.has(path)) return pending.get(path) as Promise<T>;
  const result = request<T>(path, options);
  if (get) {
    pending.set(path, result);
    void result
      .finally(() => {
        if (pending.get(path) === result) pending.delete(path);
      })
      .catch(() => {});
  }
  return result;
}
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const start = performance.now();
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options?.headers,
    },
  });
  const data = await response.json();
  if (process.env.NODE_ENV === "development") {
    studioMetrics.apiTimings.push({
      path,
      ms: Math.round(performance.now() - start),
    });
    studioMetrics.apiTimings = studioMetrics.apiTimings.slice(-10);
  }
  if (!response.ok) throw new Error(data.error ?? "Request failed.");
  return data as T;
}
