"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Camera,
  Mic,
  MicOff,
  VideoOff,
  ScanFace,
  AudioLines,
  Radio,
  Settings,
  Headphones,
} from "lucide-react";
import { useMedia } from "@/hooks/use-media";
import { useStudioSession } from "@/hooks/use-studio-session";
import { StreamVideo } from "./video";
import dynamic from "next/dynamic";
import Image from "next/image";
import {
  demoAvailable,
  hasAvatar,
  type DemoPersona,
} from "@/lib/demo-personas/types";
import { trackDemo } from "@/lib/demo-personas/analytics";
import { studioMetrics } from "@/lib/streaming/diagnostics";
const LiveControls = dynamic(() =>
  import("./controls").then((m) => m.LiveControls),
);
const ObsOutput = dynamic(() =>
  import("./obs-output").then((m) => m.ObsOutput),
);
const Diagnostics = dynamic(() =>
  import("./diagnostics").then((m) => m.Diagnostics),
);
const TrialTimer = dynamic(() =>
  import("./trial-timer").then((m) => m.TrialTimer),
);
import { Badge, Heading } from "@/components/ui";
import {
  defaults,
  studioSettings,
  type StudioSettings,
} from "@/lib/validation";
import type { Persona } from "@/types";
import type { ProductPolicy } from "@/lib/platform/schema";
import { TestNormalUser } from "@/components/admin/controls";
export function Studio({
  personas,
  demos,
  mock,
  urls,
  deviceDefaults,
  policy,
  outputOptions,
}: {
  personas: Persona[];
  demos: DemoPersona[];
  mock: boolean;
  policy?: ProductPolicy;
  outputOptions?: {
    resolutions: StudioSettings["resolution"][];
    fps: StudioSettings["fps"][];
  };
  urls: Record<string, string>;
  deviceDefaults: {
    camera?: string;
    microphone?: string;
    quality?: StudioSettings["quality"];
  };
}) {
  const visibleDemos = useMemo(
    () => demos.filter((p) => p.active && hasAvatar(p)),
    [demos],
  );
  const media = useMedia(deviceDefaults);
  if (process.env.NODE_ENV === "development") studioMetrics.renderCount++;
  const [advanced, setAdvanced] = useState(false);
  const [personaLoading, setPersonaLoading] = useState(false);
  const [previewSource, setPreviewSource] = useState("ai");
  const [personaId, setPersonaId] = useState(personas[0]?.id ?? "");
  const [settings, setSettings] = useState<StudioSettings>(defaults);
  const [monitorAudio, setMonitorAudio] = useState(false);
  const { session, output, state, error, busy, start, stop } = useStudioSession(
    personaId.startsWith("demo:") ? "" : personaId,
    settings,
    media.stream,
    personaId.startsWith("demo:") ? personaId.slice(5) : undefined,
  );
  const demo = visibleDemos.find((p) => `demo:${p.slug}` === personaId);
  const persona = personas.find((p) => p.id === personaId);
  useEffect(() => {
    const requestedDemo = new URLSearchParams(location.search).get(
      "demoPersona",
    );
    let savedPersona: string | null = null;
    try {
      savedPersona = localStorage.getItem("shapre-selected-persona");
    } catch {
      /* Optional persistence. */
    }
    const selectedDemo = visibleDemos.find((p) => p.slug === requestedDemo);
    if (selectedDemo) setPersonaId(`demo:${selectedDemo.slug}`);
    else if (
      savedPersona &&
      (personas.some((p) => p.id === savedPersona) ||
        visibleDemos.some((p) => `demo:${p.slug}` === savedPersona))
    )
      setPersonaId(savedPersona);
    const requested = new URLSearchParams(location.search).get("persona");
    if (requested && personas.some((p) => p.id === requested))
      setPersonaId(requested);
    try {
      const saved = localStorage.getItem("shapre-studio-settings");
      setSettings(
        saved
          ? studioSettings.parse(JSON.parse(saved))
          : studioSettings.parse({ quality: deviceDefaults.quality }),
      );
    } catch {
      /* Fall back to validated defaults. */
    }
  }, [personas, visibleDemos, deviceDefaults.quality]);
  const update = useCallback((value: StudioSettings) => {
    setSettings(value);
    try {
      localStorage.setItem("shapre-studio-settings", JSON.stringify(value));
    } catch {
      /* Browser persistence is optional. */
    }
  }, []);
  function selectPersona(id: string) {
    setPersonaId(id);
    try {
      localStorage.setItem("shapre-selected-persona", id);
    } catch {
      /* Browser persistence is optional. */
    }
    const next = visibleDemos.find((p) => `demo:${p.slug}` === id);
    if (next) {
      trackDemo("demo_persona_selected", next.slug);
      if (!next.voice_ready) update({ ...settings, voiceEnabled: false });
    }
  }
  useEffect(() => {
    if (demo && !demo.voice_ready && settings.voiceEnabled)
      update({ ...settings, voiceEnabled: false });
  }, [demo, settings, update]);
  const selectedImage =
    demo?.studio_avatar_url ?? demo?.thumbnail_url ?? urls[personaId];
  useEffect(() => {
    setPersonaLoading(!!selectedImage);
  }, [selectedImage]);
  const locked = !!session || state === "connecting";
  const hasCamera = media.cameraState === "camera ready";
  const aiState = error
    ? "inference unavailable"
    : session
      ? output?.getVideoTracks().some((t) => t.readyState === "live") &&
        ["live", "mock connected", "connected"].includes(state)
        ? mock
          ? "Mock active"
          : "AI active"
        : "AI connecting"
      : "AI idle";
  const showAI =
    previewSource === "ai" &&
    output &&
    ["AI active", "Mock active"].includes(aiState);
  const preview = showAI ? output : media.stream;
  return (
    <div className="stack">
      <Heading
        title="Your streaming studio"
        description="Find your presence. Then take the stage."
      >
        <div className="row">
          {policy?.role !== "user" && policy && (
            <>
              <span className="badge">
                Admin Mode{policy.testing ? " · Normal user limits" : ""}
              </span>
              <TestNormalUser
                enabled={policy.testing}
                disabled={!!session || busy}
              />
            </>
          )}
          {policy && (
            <span className="badge">
              {policy.unlimited_credits || policy.bypass_product_limits
                ? "Unlimited"
                : `${Math.max(0, policy.monthly_minutes - policy.used_minutes) + policy.balance} minutes remaining`}
            </span>
          )}
          <Badge status={media.cameraState} />
          <Badge status={aiState} />
        </div>
      </Heading>
      <div className="notice mobile-message">
        The full streaming experience works best on a desktop browser.
      </div>
      {mock && (
        <div className="notice">
          Development mock · preview and output use your original camera and
          microphone. Face and voice transformation are simulated.
        </div>
      )}
      {(error || media.error) && (
        <div className="error" role="alert">
          {[media.error, error].filter(Boolean).join(" ")}
        </div>
      )}
      <div className="studio-layout">
        <aside className="card studio-panel stack">
          <h3>Your persona</h3>
          <select
            aria-label="Select persona"
            disabled={locked}
            value={personaId}
            onChange={(e) => selectPersona(e.target.value)}
          >
            <option value="">Select a persona</option>
            <optgroup label="Your Personas">
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Shapre Demos">
              {visibleDemos.map((p) => (
                <option key={p.id} value={`demo:${p.slug}`}>
                  {p.name} ? Shapre Demo ?{" "}
                  {p.mock_available
                    ? "Available · Mock"
                    : demoAvailable(p)
                      ? "Available now"
                      : "Preview only"}
                </option>
              ))}
            </optgroup>
          </select>
          <div className="persona-art" style={{ minHeight: 170 }}>
            {selectedImage ? (
              <Image
                src={selectedImage}
                alt={demo?.name ?? persona?.name ?? "Persona"}
                width={360}
                height={360}
                sizes="260px"
                priority
                unoptimized={selectedImage.endsWith(".svg")}
                onLoad={() => setPersonaLoading(false)}
                onError={() => setPersonaLoading(false)}
              />
            ) : (
              <ScanFace size={65} strokeWidth={1} />
            )}
          </div>
          {demo ? (
            <div className="stack">
              <span className="badge">Shapre Demo Persona</span>
              <h3>{demo.name}</h3>
              <span className="badge">
                {demo.mock_available
                  ? "Available · Mock"
                  : demoAvailable(demo)
                    ? "Available now"
                    : "Preview only"}
              </span>
              <p>
                {demo.voice_ready
                  ? "Demo voice included"
                  : "Use your normal microphone"}
              </p>
              {!demoAvailable(demo) && (
                <p>
                  Avatar artwork is ready. Explore raw preview; live
                  transformation needs a prepared face model.
                </p>
              )}
              <Link href={`/demo-personas/${demo.slug}`} className="btn small">
                View demo
              </Link>
            </div>
          ) : persona ? (
            <>
              <h3>{persona.name}</h3>
              <div className="row between">
                <span className="muted">Face</span>
                <Badge status={persona.face_status} />
              </div>
              <div className="row between">
                <span className="muted">Voice</span>
                <Badge status={persona.voice_status} />
              </div>
              <Link className="btn small" href={`/personas/${persona.id}`}>
                Manage persona ↗
              </Link>
            </>
          ) : (
            <Link className="btn small" href="/personas/new">
              Create a persona
            </Link>
          )}
          <div className="divider" />
          <h3>Devices</h3>
          <label className="field">
            <span>Camera</span>
            <select
              aria-label="Camera"
              disabled={media.busy}
              value={media.camera}
              onChange={(e) => media.setCamera(e.target.value)}
            >
              <option value="">Default camera</option>
              {media.camera &&
                !media.devices.some(
                  (d) => d.kind === "videoinput" && d.deviceId === media.camera,
                ) && (
                  <option value={media.camera}>
                    Preferred camera (unavailable)
                  </option>
                )}
              {media.devices
                .filter((d) => d.kind === "videoinput")
                .map((d, index) => (
                  <option value={d.deviceId} key={d.deviceId}>
                    {d.label || `Camera ${index + 1}`}
                  </option>
                ))}
            </select>
          </label>
          <label className="field">
            <span>Microphone</span>
            <select
              aria-label="Microphone"
              disabled={media.busy}
              value={media.microphone}
              onChange={(e) => media.setMicrophone(e.target.value)}
            >
              <option value="">Default microphone</option>
              {media.microphone &&
                !media.devices.some(
                  (d) =>
                    d.kind === "audioinput" && d.deviceId === media.microphone,
                ) && (
                  <option value={media.microphone}>
                    Preferred microphone (unavailable)
                  </option>
                )}
              {media.devices
                .filter((d) => d.kind === "audioinput")
                .map((d, index) => (
                  <option value={d.deviceId} key={d.deviceId}>
                    {d.label || `Microphone ${index + 1}`}
                  </option>
                ))}
            </select>
          </label>
          <button
            className="btn small"
            disabled={media.busy || !media.ready}
            onClick={() => {
              void media.open();
            }}
          >
            {media.busy
              ? "Requesting access…"
              : media.stream
                ? "Retry device access"
                : "Enable camera & mic"}
          </button>
          <p style={{ fontSize: 11 }}>
            Preview stays on this device. Media is sent only after you start a
            session.
          </p>
        </aside>
        <div>
          <div className="preview">
            <StreamVideo stream={preview} muted={!showAI || !monitorAudio} />
            {!hasCamera && (
              <div className="preview-empty">
                <div className="empty-icon">
                  <Camera size={28} />
                </div>
                <h2>
                  {persona || demo
                    ? "Your stage is waiting."
                    : "Choose your persona."}
                </h2>
                <p>
                  {persona || demo
                    ? "Enable your camera and microphone to preview."
                    : "Select or create a persona to get started."}
                </p>
              </div>
            )}
            <span className="preview-label badge">
              {showAI
                ? mock
                  ? "MOCK / ORIGINAL CAMERA"
                  : "Inference output"
                : "Raw camera preview"}
            </span>
            {session?.watermark && (
              <span className="preview-watermark">shapre.</span>
            )}
          </div>
          <div className="studio-controls">
            <button
              className="btn small"
              onClick={() =>
                setPreviewSource(previewSource === "raw" ? "ai" : "raw")
              }
              disabled={!output}
            >
              {previewSource === "raw" ? "Show AI output" : "Show raw camera"}
            </button>
            <button
              className="btn small"
              disabled={!showAI}
              title="Use headphones when monitoring output"
              onClick={() => setMonitorAudio(!monitorAudio)}
            >
              <Headphones size={16} />
              Monitor {monitorAudio ? "on" : "off"}
            </button>
            <button
              className="btn small"
              disabled={!media.stream}
              onClick={media.toggleCamera}
            >
              {media.cameraOn ? <Camera size={16} /> : <VideoOff size={16} />}
              Camera
            </button>
            <button
              className="btn small"
              disabled={!media.stream}
              onClick={media.toggleMic}
            >
              {media.micOn ? <Mic size={16} /> : <MicOff size={16} />}Mic
            </button>
            <button
              disabled={locked}
              className="btn small"
              onClick={() =>
                update({ ...settings, faceEnabled: !settings.faceEnabled })
              }
            >
              <ScanFace size={16} />
              Face {settings.faceEnabled ? "on" : "off"}
            </button>
            <button
              disabled={locked || (!!demo && !demo.voice_ready)}
              className="btn small"
              onClick={() =>
                update({ ...settings, voiceEnabled: !settings.voiceEnabled })
              }
            >
              <AudioLines size={16} />
              Voice {settings.voiceEnabled ? "on" : "off"}
            </button>
            <Link
              className="btn small"
              href="/settings"
              aria-label="Studio settings"
            >
              <Settings size={16} />
            </Link>
            <button
              disabled={
                busy ||
                (!session &&
                  (!hasCamera ||
                    media.busy ||
                    !personaId ||
                    (demo
                      ? !demoAvailable(demo)
                      : persona?.face_status !== "ready")))
              }
              className={`btn small ${session ? "danger" : "primary"}`}
              onClick={session ? stop : start}
            >
              <Radio size={15} />
              {busy
                ? "Please wait…"
                : session
                  ? "Stop Live"
                  : demo
                    ? policy?.bypass_trial_limit && !policy.testing
                      ? "Start Live"
                      : "Start Trial"
                    : "Start Live"}
            </button>
          </div>
          {personaLoading && <p role="status">Loading persona preview...</p>}
          {session?.expiresAt && (
            <TrialTimer
              expiresAt={session.expiresAt}
              onExpire={stop}
              trial={session.trial === true}
            />
          )}
          {process.env.NODE_ENV === "development" && (
            <Diagnostics stream={media.stream} state={aiState} />
          )}
          {session && <ObsOutput url={session.outputUrl} mock={mock} />}
        </div>
        <div className="stack" style={{ alignSelf: "start" }}>
          <button
            className="btn"
            aria-expanded={advanced}
            onClick={() => setAdvanced(!advanced)}
          >
            Advanced controls
          </button>
          {advanced && (
            <LiveControls
              settings={settings}
              onChange={update}
              disabled={locked}
              outputOptions={outputOptions}
            />
          )}
        </div>
      </div>
    </div>
  );
}
