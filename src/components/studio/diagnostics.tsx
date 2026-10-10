"use client";
import { useEffect, useState } from "react";
import { studioMetrics } from "@/lib/streaming/diagnostics";
export function Diagnostics({
  stream,
  state,
}: {
  stream: MediaStream | null;
  state: string;
}) {
  const [stats, setStats] = useState({
    fps: 0,
    dropped: 0,
    renders: 0,
    resolution: "—",
    connection: "—",
    latency: "—",
    api: "—",
  });
  useEffect(() => {
    let lastFrames = 0,
      lastTime = performance.now();
    const timer = setInterval(() => {
      const video = document.querySelector<HTMLVideoElement>(".preview video");
      const quality = video?.getVideoPlaybackQuality();
      const now = performance.now();
      const frames = quality?.totalVideoFrames ?? 0;
      const settings = stream?.getVideoTracks()[0]?.getSettings();
      const api = studioMetrics.apiTimings.at(-1);
      setStats({
        fps: Math.max(
          0,
          Math.round(((frames - lastFrames) * 1000) / (now - lastTime)),
        ),
        dropped: quality?.droppedVideoFrames ?? 0,
        renders: studioMetrics.renderCount,
        resolution: settings?.width
          ? `${settings.width} × ${settings.height}`
          : "—",
        connection:
          studioMetrics.connectionMs === undefined
            ? "—"
            : `${studioMetrics.connectionMs} ms`,
        latency:
          studioMetrics.latencyMs === undefined
            ? "—"
            : `${studioMetrics.latencyMs} ms (worker)`,
        api: api ? `${api.path}: ${api.ms} ms` : "—",
      });
      lastFrames = frames;
      lastTime = now;
    }, 1000);
    return () => clearInterval(timer);
  }, [stream]);
  return (
    <details className="card">
      <summary>Development diagnostics</summary>
      <div className="diagnostics">
        <span>{state}</span>
        <span>Preview {stats.fps} FPS</span>
        <span>{stats.resolution}</span>
        <span>Dropped frames {stats.dropped}</span>
        <span>Studio renders {stats.renders}</span>
        <span>AI connection {stats.connection}</span>
        <span>Latency {stats.latency}</span>
        <span>Last API {stats.api}</span>
      </div>
      <p>
        Worker latency is reported by the service; true end-to-end latency
        requires timestamp instrumentation in the worker.
      </p>
    </details>
  );
}
