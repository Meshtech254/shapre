"use client";
import { useEffect, useState } from "react";
import { Upload, X } from "lucide-react";
import { validateFile } from "@/lib/validation";
import { toast } from "sonner";
export function FilePicker({
  kind,
  files,
  onChange,
}: {
  kind: "face" | "voice";
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const [previews, setPreviews] = useState<string[]>([]);
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);
  function accept(incoming: File[]) {
    try {
      incoming.forEach((f) => validateFile(kind, f.type, f.size));
      if (kind === "face" && files.length + incoming.length > 10)
        throw new Error("Upload at most 10 face images.");
      onChange(
        kind === "face" ? [...files, ...incoming] : incoming.slice(0, 1),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Invalid upload.");
    }
  }
  return (
    <div className="stack">
      <label
        className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          accept(Array.from(e.dataTransfer.files));
        }}
      >
        <Upload size={26} color="var(--accent)" />
        <strong>
          {kind === "face"
            ? "Drop your face images here"
            : "Drop a voice recording here"}
        </strong>
        <p>or click to browse</p>
        <span className="muted" style={{ fontSize: 11 }}>
          {kind === "face"
            ? "JPG, PNG, WebP · up to 10 MB each · 1–10 images"
            : "MP3, WAV, M4A, WebM · up to 50 MB"}
        </span>
        <input
          hidden
          type="file"
          multiple={kind === "face"}
          accept={
            kind === "face"
              ? "image/jpeg,image/png,image/webp"
              : ".mp3,.wav,.m4a,.webm"
          }
          onChange={(e) => {
            accept(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </label>
      {kind === "face" ? (
        <div className="thumbs">
          {files.map((f, i) => (
            <div className="thumb" key={`${f.name}-${i}`}>
              <img src={previews[i]} alt={`Face image ${i + 1}`} />
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => onChange(files.filter((_, n) => n !== i))}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        files[0] && (
          <div className="card stack">
            <div className="row between">
              <span>{files[0].name}</span>
              <button className="btn small" onClick={() => onChange([])}>
                Remove
              </button>
            </div>
            <audio controls src={previews[0]} style={{ width: "100%" }} />
          </div>
        )
      )}
    </div>
  );
}
