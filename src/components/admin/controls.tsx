"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { entitlementSchemas } from "@/lib/platform/schema";
type Changes = Record<string, unknown>;
export function AdminMutation({
  operation,
  target,
  initial,
  label = "Save",
  destructive = false,
}: {
  operation: string;
  target: string;
  initial: Changes;
  label?: string;
  destructive?: boolean;
}) {
  const [changes, setChanges] = useState(initial),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        if (
          busy ||
          (destructive &&
            !window.confirm(
              `${label}? This will change the selected account or session.`,
            ))
        )
          return;
        setBusy(true);
        setMessage("");
        try {
          await api("/api/admin/mutate", {
            method: "POST",
            body: JSON.stringify({ operation, target, changes, reason }),
          });
          setMessage("Saved and audited.");
          router.refresh();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Save failed.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {Object.entries(changes).map(([key, value]) => (
        <label className="field" key={key}>
          <span>{key.replaceAll("_", " ")}</span>
          {typeof value === "boolean" ? (
            <input
              aria-label={key}
              type="checkbox"
              checked={value}
              onChange={(e) =>
                setChanges({ ...changes, [key]: e.target.checked })
              }
            />
          ) : typeof value === "number" ? (
            <input
              aria-label={key}
              type="number"
              step="any"
              value={value}
              onChange={(e) =>
                setChanges({ ...changes, [key]: Number(e.target.value) })
              }
            />
          ) : typeof value === "object" && value !== null ? (
            <JsonField
              value={value}
              onChange={(v) => setChanges({ ...changes, [key]: v })}
            />
          ) : key === "role" ? (
            <select
              value={String(value)}
              onChange={(e) =>
                setChanges({ ...changes, [key]: e.target.value })
              }
            >
              {["user", "admin", "super_admin"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          ) : (
            <input
              aria-label={key}
              value={value === null ? "" : String(value)}
              onChange={(e) =>
                setChanges({
                  ...changes,
                  [key]: e.target.value || (value === null ? null : ""),
                })
              }
            />
          )}
        </label>
      ))}
      <label className="field">
        <span>Reason</span>
        <input
          required
          minLength={3}
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </label>
      <button
        className={`btn ${destructive ? "danger" : "primary"}`}
        disabled={busy}
      >
        {busy ? "Saving…" : label}
      </button>
      <p role="status">{message}</p>
    </form>
  );
}
function JsonField({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const [text, setText] = useState(JSON.stringify(value, null, 2)),
    [invalid, setInvalid] = useState(false);
  return (
    <>
      <textarea
        aria-label="Configuration value"
        rows={5}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            onChange(JSON.parse(e.target.value));
            setInvalid(false);
            e.currentTarget.setCustomValidity("");
          } catch {
            setInvalid(true);
            e.currentTarget.setCustomValidity(
              "Enter valid JSON before saving.",
            );
          }
        }}
      />
      {invalid && (
        <span className="error">Enter valid JSON before saving.</span>
      )}
    </>
  );
}
export function EntitlementControl({ id }: { id: string }) {
  const [key, setKey] = useState("unlimited_streaming");
  const booleanKey =
    key.startsWith("unlimited_") ||
    key.startsWith("bypass_") ||
    key.startsWith("access_") ||
    key === "trial_enabled";
  return (
    <div className="stack">
      <select
        aria-label="Entitlement"
        value={key}
        onChange={(e) => setKey(e.target.value)}
      >
        {Object.keys(entitlementSchemas).map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
      <AdminMutation
        key={key}
        operation="entitlement"
        target={id}
        initial={{
          key,
          value: booleanKey
            ? true
            : key === "trial_seconds"
              ? 3600
              : key === "persona_limit"
                ? 100
                : 5,
          starts_at: null,
          expires_at: null,
        }}
        label="Grant override"
      />
    </div>
  );
}
export function TestNormalUser({
  enabled,
  disabled = false,
}: {
  enabled: boolean;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const router = useRouter();
  return (
    <div>
      <button
        className="btn small"
        disabled={busy || disabled}
        onClick={async () => {
          setBusy(true);
          try {
            await api("/api/admin/test-mode", {
              method: "POST",
              body: JSON.stringify({ enabled: !enabled }),
            });
            router.refresh();
          } catch (e) {
            setError(
              e instanceof Error ? e.message : "Could not switch testing mode.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {enabled ? "Restore admin entitlements" : "Test as normal user"}
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
export function AvatarUpload({ id }: { id: string }) {
  const [role, setRole] = useState("thumbnail"),
    [reason, setReason] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <div className="stack">
      <h3>Upload avatar image</h3>
      <select
        aria-label="Image role"
        value={role}
        onChange={(e) => setRole(e.target.value)}
      >
        {["thumbnail", "preview", "studio", "face_source"].map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
      <input
        aria-label="Upload reason"
        placeholder="Reason for replacing this image"
        minLength={3}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={busy || reason.trim().length < 3}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setBusy(true);
          try {
            const payload = {
              id,
              role,
              mime: file.type,
              size: file.size,
              reason,
            };
            const signed = await api<{
              bucket: string;
              path: string;
              token: string;
            }>("/api/admin/avatar-upload", {
              method: "POST",
              body: JSON.stringify(payload),
            });
            const { browserSupabase } = await import("@/lib/supabase/browser");
            const uploaded = await browserSupabase()
              .storage.from(signed.bucket)
              .uploadToSignedUrl(signed.path, signed.token, file);
            if (uploaded.error) throw uploaded.error;
            await api("/api/admin/avatar-upload", {
              method: "POST",
              body: JSON.stringify({ ...payload, path: signed.path }),
            });
            setMessage("Image saved and audited.");
            router.refresh();
          } catch (error) {
            setMessage(
              error instanceof Error ? error.message : "Upload failed.",
            );
          } finally {
            setBusy(false);
          }
        }}
      />
      <p role="status">{message}</p>
      <button
        className="btn"
        disabled={busy || reason.trim().length < 3}
        onClick={async () => {
          setBusy(true);
          try {
            const result = await api<{ status: string }>(
              "/api/admin/prepare-demo",
              { method: "POST", body: JSON.stringify({ id, reason }) },
            );
            setMessage(`Worker preparation: ${result.status}`);
            router.refresh();
          } catch (e) {
            setMessage(
              e instanceof Error ? e.message : "Worker preparation failed.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        Prepare face with inference worker
      </button>
    </div>
  );
}
