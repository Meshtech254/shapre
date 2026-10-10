"use client";
import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Heading } from "@/components/ui";
import { api } from "@/lib/client-api";
import { useMedia } from "@/hooks/use-media";
import type { StudioSettings } from "@/lib/validation";
export function SettingsForm({
  email,
  name,
  defaults,
}: {
  email: string;
  name: string;
  defaults: {
    camera?: string;
    microphone?: string;
    quality?: StudioSettings["quality"];
  };
}) {
  const [displayName, setDisplayName] = useState(name);
  const [camera, setCamera] = useState(defaults.camera ?? "");
  const [mic, setMic] = useState(defaults.microphone ?? "");
  const [quality, setQuality] = useState(defaults.quality ?? "Balanced");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const media = useMedia();
  return (
    <div className="stack" style={{ maxWidth: 900 }}>
      <Heading
        title="Settings"
        description="Make your workspace feel like yours."
      />
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api("/api/v1/settings", {
              method: "POST",
              body: JSON.stringify({
                display_name: displayName,
                streaming_defaults: { camera, microphone: mic, quality },
              }),
            });
            localStorage.setItem(
              "shapre-device-defaults",
              JSON.stringify({ camera, microphone: mic, quality }),
            );
            localStorage.setItem("shapre-camera", camera);
            localStorage.setItem("shapre-microphone", mic);
            toast.success("Settings saved");
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Could not save settings.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="card stack">
          <h2>Account</h2>
          <label className="field">
            <span>Display name</span>
            <input
              value={displayName}
              maxLength={80}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Email</span>
            <input value={email} readOnly type="email" />
          </label>
        </div>
        <div className="card stack">
          <h2>Streaming defaults</h2>
          <p style={{ fontSize: 12 }}>
            Allow device access to discover named cameras and microphones. This
            preview stays local.
          </p>
          <button
            type="button"
            className="btn small"
            disabled={media.busy}
            onClick={media.open}
          >
            Discover devices
          </button>
          {media.error && <div className="error">{media.error}</div>}
          <div className="grid2">
            <label className="field">
              <span>Default camera</span>
              <select
                value={camera}
                onChange={(e) => setCamera(e.target.value)}
              >
                <option value="">System default</option>
                {media.devices
                  .filter((d) => d.kind === "videoinput")
                  .map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || "Camera"}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span>Default microphone</span>
              <select value={mic} onChange={(e) => setMic(e.target.value)}>
                <option value="">System default</option>
                {media.devices
                  .filter((d) => d.kind === "audioinput")
                  .map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || "Microphone"}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <label className="field">
            <span>Default quality mode</span>
            <select
              value={quality}
              onChange={(e) =>
                setQuality(e.target.value as StudioSettings["quality"])
              }
            >
              <option>Low Latency</option>
              <option>Balanced</option>
              <option>High Quality</option>
            </select>
          </label>
        </div>
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        <button
          disabled={busy}
          className="btn primary"
          style={{ justifySelf: "start" }}
        >
          {busy ? "Saving…" : "Save settings"}
        </button>
      </form>
      <div className="card stack">
        <h2>Safety & privacy</h2>
        <p>
          Your face images and voice recordings are sensitive. Upload only
          assets you own or have permission to use.
        </p>
        <p>
          Delete a persona from its details page to remove its assets from
          active storage. Infrastructure backups may persist under your
          deployment’s backup retention settings.
        </p>
        <Link href="/legal/privacy" className="muted">
          Read the privacy policy ↗
        </Link>
      </div>
    </div>
  );
}
