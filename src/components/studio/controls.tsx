"use client";
import type { StudioSettings } from "@/lib/validation";
export function LiveControls({
  settings,
  onChange,
  disabled = false,
  outputOptions,
}: {
  settings: StudioSettings;
  onChange: (value: StudioSettings) => void;
  disabled?: boolean;
  outputOptions?: {
    resolutions: StudioSettings["resolution"][];
    fps: StudioSettings["fps"][];
  };
}) {
  function set<K extends keyof StudioSettings>(
    key: K,
    value: StudioSettings[K],
  ) {
    onChange({ ...settings, [key]: value });
  }
  function slider(
    key: "smoothing" | "expression" | "similarity" | "pitch" | "stability",
    label: string,
    min = 0,
    max = 100,
  ) {
    return (
      <label className="field">
        <span className="row between">
          {label}
          <span>{settings[key]}</span>
        </span>
        <input
          disabled={disabled}
          type="range"
          min={min}
          max={max}
          value={settings[key]}
          onChange={(e) => set(key, Number(e.target.value))}
        />
      </label>
    );
  }
  return (
    <div className="card studio-panel stack">
      <div className="stack">
        <h3>Face controls</h3>
        <label className="field">
          <span>Output resolution</span>
          <select
            disabled={disabled}
            value={settings.resolution}
            onChange={(e) =>
              set("resolution", e.target.value as StudioSettings["resolution"])
            }
          >
            {(outputOptions?.resolutions ?? ["1280x720"]).map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Output FPS</span>
          <select
            disabled={disabled}
            value={settings.fps}
            onChange={(e) =>
              set("fps", Number(e.target.value) as StudioSettings["fps"])
            }
          >
            {(outputOptions?.fps ?? [30]).map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label className="consent">
          <input
            disabled={disabled}
            type="checkbox"
            checked={settings.faceEnabled}
            onChange={(e) => set("faceEnabled", e.target.checked)}
          />
          Transformation enabled
        </label>
        {slider("smoothing", "Smoothing")}
        {slider("expression", "Expression strength")}
        <label className="field">
          <span>Quality mode</span>
          <select
            disabled={disabled}
            value={settings.quality}
            onChange={(e) =>
              set("quality", e.target.value as StudioSettings["quality"])
            }
          >
            <option>Low Latency</option>
            <option>Balanced</option>
            <option>High Quality</option>
          </select>
        </label>
      </div>
      <div className="stack">
        <div className="divider" />
        <h3>Voice controls</h3>
        <label className="consent">
          <input
            disabled={disabled}
            type="checkbox"
            checked={settings.voiceEnabled}
            onChange={(e) => set("voiceEnabled", e.target.checked)}
          />
          Voice transformation enabled
        </label>
        {slider("similarity", "Similarity")}
        {slider("pitch", "Pitch", -12, 12)}
        {slider("stability", "Stability")}
        <label className="consent">
          <input
            disabled={disabled}
            type="checkbox"
            checked={settings.noiseReduction}
            onChange={(e) => set("noiseReduction", e.target.checked)}
          />
          Noise reduction
        </label>
        <p style={{ fontSize: 11 }}>
          Settings are sent when you start. Actual processing depends on the
          connected inference service.
        </p>
      </div>
    </div>
  );
}
