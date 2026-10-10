"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/client-api";
import { uploadAsset } from "@/lib/uploads";
import { FilePicker } from "./file-picker";
import { Heading } from "@/components/ui";
export function PersonaWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [faces, setFaces] = useState<File[]>([]);
  const [voices, setVoices] = useState<File[]>([]);
  const [faceConsent, setFaceConsent] = useState(false);
  const [voiceConsent, setVoiceConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState<string>();
  const labels = [
    "Persona details",
    "Face identity",
    "Voice identity",
    "Review",
  ];
  const canContinue =
    step === 0
      ? name.trim().length >= 2
      : step === 1
        ? faces.length > 0 && faceConsent
        : step === 2
          ? !voices.length || voiceConsent
          : true;
  async function create() {
    setBusy(true);
    setError("");
    let id = createdId;
    try {
      if (!id) {
        const created = await api<{ id: string }>("/api/v1/personas", {
          method: "POST",
          body: JSON.stringify({
            name,
            description,
            consentFace: faceConsent,
            consentVoice: voiceConsent && voices.length > 0,
          }),
        });
        id = created.id;
        setCreatedId(id);
      }
      const total = faces.length + voices.length;
      for (let i = 0; i < faces.length; i++)
        await uploadAsset(id, "face", faces[i], (n) =>
          setProgress(((i + n / 100) / total) * 100),
        );
      if (voices[0])
        await uploadAsset(id, "voice", voices[0], (n) =>
          setProgress(((faces.length + n / 100) / total) * 100),
        );
      toast.success("Your persona is created. Prepare your identities next.");
      router.push(`/personas/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create persona.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="wizard">
      <Heading
        title="Make it yours."
        description="Build your next streaming identity, one step at a time."
      />
      <div className="steps">
        {labels.map((label, i) => (
          <div key={label} className={`step ${i === step ? "current" : ""}`}>
            {String(i + 1).padStart(2, "0")} &nbsp;{label}
          </div>
        ))}
      </div>
      <div className="card stack">
        {step === 0 && (
          <>
            <div>
              <h2>Give your persona a name.</h2>
              <p>A name you’ll recognize in your studio.</p>
            </div>
            <label className="field">
              <span>Persona name</span>
              <input
                value={name}
                maxLength={60}
                placeholder="e.g. Nova"
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="field">
              <span>
                Description <span className="muted">(optional)</span>
              </span>
              <textarea
                value={description}
                maxLength={500}
                placeholder="A little about this identity…"
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
          </>
        )}
        {step === 1 && (
          <>
            <div>
              <h2>Your face identity.</h2>
              <p>
                Upload 1–10 images. We recommend 3–10 clear images from
                different angles.
              </p>
            </div>
            <div className="notice">
              Use clear lighting, keep the face visible, and avoid heavy
              filters. Multiple angles are useful.
            </div>
            <FilePicker kind="face" files={faces} onChange={setFaces} />
            <label className="consent">
              <input
                type="checkbox"
                checked={faceConsent}
                onChange={(e) => setFaceConsent(e.target.checked)}
              />
              <span>
                I confirm that I own these images or have permission from the
                person shown to use them to create this AI persona.
              </span>
            </label>
          </>
        )}
        {step === 2 && (
          <>
            <div>
              <h2>A voice of your own.</h2>
              <p>Add a voice sample, or continue and set it up later.</p>
            </div>
            <div className="notice">
              Recommend 30–90 seconds, one speaker, a quiet environment, and a
              natural speaking voice.
            </div>
            <FilePicker kind="voice" files={voices} onChange={setVoices} />
            <label className="consent">
              <input
                type="checkbox"
                checked={voiceConsent}
                onChange={(e) => setVoiceConsent(e.target.checked)}
              />
              <span>
                I confirm that I own this voice recording or have permission
                from the speaker to use their voice with Shapre.
              </span>
            </label>
          </>
        )}
        {step === 3 && (
          <>
            <h2>Ready to create {name}?</h2>
            <div className="card stack">
              <div className="row between">
                <span>Persona name</span>
                <strong>{name}</strong>
              </div>
              <div className="row between">
                <span>Face identity</span>
                <span>{faces.length} images · rights confirmed</span>
              </div>
              <div className="row between">
                <span>Voice identity</span>
                <span>
                  {voices.length
                    ? "1 sample · rights confirmed"
                    : "Skipped for now"}
                </span>
              </div>
            </div>
            <p style={{ fontSize: 12 }}>
              Files stay private. Identity preparation happens separately after
              upload.
            </p>
          </>
        )}
        {error && (
          <div className="error" role="alert">
            {error}
            {createdId && (
              <p style={{ marginTop: 8 }}>
                Your draft was saved. Open it to continue uploading without
                duplicating successful uploads.
              </p>
            )}
            {createdId && (
              <button
                className="btn small"
                onClick={() => router.push(`/personas/${createdId}`)}
              >
                Open saved draft
              </button>
            )}
          </div>
        )}
        {busy && (
          <>
            <div className="progress">
              <div style={{ width: `${progress}%` }} />
            </div>
            <p>Uploading your assets… {Math.round(progress)}%</p>
          </>
        )}
        <div className="row between">
          <button
            disabled={step === 0 || busy || !!createdId}
            className="btn"
            onClick={() => setStep(step - 1)}
          >
            Back
          </button>
          {step < 3 ? (
            <button
              disabled={!canContinue || busy}
              className="btn primary"
              onClick={() => setStep(step + 1)}
            >
              {step === 2 && !voices.length ? "Skip voice setup" : "Continue"} →
            </button>
          ) : (
            <button
              disabled={busy || !!createdId}
              className="btn primary"
              onClick={create}
            >
              {busy ? "Creating…" : "Create persona"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
