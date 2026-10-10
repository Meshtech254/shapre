"use client";
import { Copy, Monitor } from "lucide-react";
import { toast } from "sonner";
export function ObsOutput({ url, mock }: { url?: string; mock: boolean }) {
  return (
    <div className="card stack">
      <div className="row">
        <Monitor size={18} color="var(--accent)" />
        <h3>OBS Output</h3>
      </div>
      {url ? (
        <>
          <div className="row">
            <input aria-label="OBS output URL" readOnly value={url} />
            <button
              className="btn"
              aria-label="Copy output URL"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  toast.success("Output URL copied");
                } catch {
                  toast.error("Copy failed. Select and copy the URL manually.");
                }
              }}
            >
              <Copy size={16} />
            </button>
          </div>
          <a href={url} target="_blank" rel="noreferrer" className="btn small">
            Open output preview ↗
          </a>
        </>
      ) : (
        <p>Start a session to get your private output link.</p>
      )}
      <ol
        style={{
          paddingLeft: 20,
          fontSize: 12,
          color: "var(--muted)",
          margin: 0,
        }}
      >
        <li>Open OBS and add a Browser Source.</li>
        <li>Paste your Shapre output URL.</li>
        <li>Set the resolution to 1280 × 720.</li>
        <li>Enable browser source audio if needed.</li>
      </ol>
      <p style={{ fontSize: 11 }}>
        Output links grant access to your stream and expire after 8 hours. Keep
        them private.
        {mock
          ? " Local mock output works in another tab of this browser only; OBS cannot share the browser’s local bridge. Real OBS streaming requires the external inference service."
          : ""}
      </p>
    </div>
  );
}
