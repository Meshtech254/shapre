"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Fingerprint, Check, Radio, Trash2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client-api";
import { uploadAsset } from "@/lib/uploads";
import { Badge, Heading } from "@/components/ui";
import { FilePicker } from "./file-picker";
import type { Persona, Asset } from "@/types";
interface Detail {
  persona: Persona;
  faces: Asset[];
  voices: Asset[];
  mock: boolean;
}
export function PersonaDetails({ id }: { id: string }) {
  const assetUrls = useRef(new Map<string, { url: string; expires: number }>());
  const router = useRouter();
  const [data, setData] = useState<Detail>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [kind, setKind] = useState<"face" | "voice">("face");
  const [consent, setConsent] = useState(false);
  const [progress, setProgress] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const refresh = useCallback(async () => {
    try {
      const next = await api<Detail>(`/api/v1/personas/${id}`);
      for (const asset of [...next.faces, ...next.voices]) {
        const cached = assetUrls.current.get(asset.id);
        if (cached && cached.expires > Date.now()) asset.url = cached.url;
        else if (asset.url)
          assetUrls.current.set(asset.id, {
            url: asset.url,
            expires: Date.now() + 14 * 60 * 1000,
          });
      }
      setData(next);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load persona.");
    }
  }, [id]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 30000);
    return () => clearInterval(timer);
  }, [refresh]);
  async function perform(fn: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    try {
      await fn();
      toast.success(success);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed.");
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <div className="card empty">
        {error ? (
          <>
            <div className="error">{error}</div>
            <button className="btn" onClick={refresh}>
              Try again
            </button>
          </>
        ) : (
          <p>Loading your persona…</p>
        )}
      </div>
    );
  const { persona, faces, voices, mock } = data;
  return (
    <div className="stack">
      <Heading
        title={persona.name}
        description={
          persona.description ||
          "Your streaming identity. Your creative presence."
        }
      >
        <Link className="btn primary" href={`/studio?persona=${id}`}>
          <Radio size={16} />
          Open Studio
        </Link>
      </Heading>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {mock && (
        <div className="notice">
          Development mock mode · preparation is simulated. No AI transformation
          takes place.
        </div>
      )}
      <div className="grid2">
        <div className="persona-art" style={{ minHeight: 360 }}>
          {faces[0]?.url ? (
            <img alt={persona.name} src={faces[0].url} />
          ) : (
            <Fingerprint size={120} strokeWidth={0.7} />
          )}
        </div>
        <div className="card stack">
          <div className="row between">
            <h2>Live readiness</h2>
            <Badge status={persona.status} />
          </div>
          {[
            ["Face identity", persona.face_status],
            ["Voice identity", persona.voice_status],
            ["Camera access", "Check in Studio"],
            ["Microphone access", "Check in Studio"],
          ].map(([label, status]) => (
            <div className="row between" key={label}>
              <span className="row">
                {status === "ready" ? (
                  <Check size={17} color="var(--accent)" />
                ) : (
                  <span className="muted">○</span>
                )}
                {label}
              </span>
              <Badge status={status} />
            </div>
          ))}
          <p style={{ fontSize: 12 }}>
            Face must be ready to start a session. Voice transformation is
            optional. Device permissions are requested inside the studio.
          </p>
        </div>
      </div>
      <div className="grid2">
        <div className="card stack">
          <div className="row between">
            <h2>Face identity</h2>
            <Badge status={persona.face_status} />
          </div>
          <div className="thumbs">
            {faces.map((a) => (
              <div className="thumb" key={a.id}>
                <img src={a.url} alt={a.original_filename} />
                <button
                  disabled={busy}
                  aria-label={`Remove ${a.original_filename}`}
                  onClick={() =>
                    perform(
                      () =>
                        api(`/api/v1/personas/${id}/asset`, {
                          method: "POST",
                          body: JSON.stringify({
                            kind: "face",
                            assetId: a.id,
                            operation: "remove",
                          }),
                        }),
                      "Image removed",
                    )
                  }
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          {!faces.length && <p>No face images yet.</p>}
          <div className="row">
            <button
              disabled={busy || !faces.length}
              className="btn small"
              onClick={() =>
                perform(
                  () =>
                    api(`/api/v1/personas/${id}/prepare`, {
                      method: "POST",
                      body: JSON.stringify({ kind: "face" }),
                    }),
                  "Face preparation requested",
                )
              }
            >
              <RefreshCw size={13} />
              {persona.face_status === "ready" ? "Reprocess" : "Prepare face"}
            </button>
            <button
              className="btn small"
              onClick={() => {
                setKind("face");
                setFiles([]);
                setConsent(false);
              }}
            >
              Add images ↓
            </button>
          </div>
        </div>
        <div className="card stack">
          <div className="row between">
            <h2>Voice identity</h2>
            <Badge status={persona.voice_status} />
          </div>
          {voices[0] ? (
            <>
              <p>
                {voices[0].original_filename}
                {voices[0].duration_seconds
                  ? ` · ${Math.round(voices[0].duration_seconds)} seconds`
                  : ""}
              </p>
              <audio controls src={voices[0].url} style={{ width: "100%" }} />
              <div className="row">
                <button
                  disabled={busy}
                  className="btn small"
                  onClick={() =>
                    perform(
                      () =>
                        api(`/api/v1/personas/${id}/prepare`, {
                          method: "POST",
                          body: JSON.stringify({ kind: "voice" }),
                        }),
                      "Voice preparation requested",
                    )
                  }
                >
                  Prepare voice
                </button>
                <button
                  disabled={busy}
                  className="btn small danger"
                  onClick={() =>
                    perform(
                      () =>
                        api(`/api/v1/personas/${id}/asset`, {
                          method: "POST",
                          body: JSON.stringify({
                            kind: "voice",
                            assetId: voices[0].id,
                            operation: "remove",
                          }),
                        }),
                      "Voice removed. You can upload a replacement.",
                    )
                  }
                >
                  Remove / replace
                </button>
              </div>
            </>
          ) : (
            <>
              <p>Add a recording to give your persona a voice.</p>
              <button
                className="btn small"
                onClick={() => {
                  setKind("voice");
                  setFiles([]);
                  setConsent(false);
                }}
              >
                Add voice sample ↓
              </button>
            </>
          )}
        </div>
      </div>
      <div className="card stack">
        <div className="row between">
          <h2>Add {kind === "face" ? "face images" : "a voice sample"}</h2>
          <select
            aria-label="Upload type"
            style={{ width: 180 }}
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as "face" | "voice");
              setFiles([]);
              setConsent(false);
            }}
          >
            <option value="face">Face images</option>
            <option value="voice">Voice recording</option>
          </select>
        </div>
        <FilePicker kind={kind} files={files} onChange={setFiles} />
        <label className="consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            {kind === "face"
              ? "I confirm that I own these images or have permission from the person shown to use them to create this AI persona."
              : "I confirm that I own this voice recording or have permission from the speaker to use their voice with Shapre."}
          </span>
        </label>
        {busy && (
          <div className="progress">
            <div style={{ width: `${progress}%` }} />
          </div>
        )}
        <button
          disabled={busy || !consent || !files.length}
          className="btn primary"
          onClick={() =>
            perform(async () => {
              for (const f of files)
                await uploadAsset(id, kind, f, setProgress);
              setFiles([]);
              setConsent(false);
            }, "Assets uploaded")
          }
        >
          Upload {files.length ? files.length : ""}{" "}
          {kind === "face" ? "images" : "sample"}
        </button>
      </div>
      <div className="card row between">
        <div>
          <h3>Delete persona</h3>
          <p style={{ fontSize: 12 }}>
            Permanently remove this persona and its stored face and voice
            assets.
          </p>
        </div>
        {confirmDelete ? (
          <div className="row">
            <button
              className="btn small"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
            <button
              disabled={busy}
              className="btn danger"
              onClick={() =>
                perform(async () => {
                  await api(`/api/v1/personas/${id}`, { method: "DELETE" });
                  router.push("/personas");
                }, "Persona deleted")
              }
            >
              Confirm deletion
            </button>
          </div>
        ) : (
          <button className="btn danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={15} />
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
