"use client";
import { api } from "@/lib/client-api";
import { browserSupabase } from "@/lib/supabase/browser";
async function duration(file: File) {
  return new Promise<number | undefined>((resolve) => {
    const audio = document.createElement("audio");
    const url = URL.createObjectURL(file);
    const finish = (value?: number) => {
      clearTimeout(timer);
      URL.revokeObjectURL(url);
      audio.removeAttribute("src");
      resolve(value);
    };
    const timer = setTimeout(() => finish(), 3000);
    audio.onloadedmetadata = () =>
      finish(Number.isFinite(audio.duration) ? audio.duration : undefined);
    audio.onerror = () => finish();
    audio.src = url;
  });
}
export async function uploadAsset(
  personaId: string,
  kind: "face" | "voice",
  file: File,
  onProgress: (n: number) => void,
) {
  const ticket = await api<{
    assetId: string;
    path: string;
    token: string;
    bucket: string;
  }>(`/api/v1/personas/${personaId}/upload`, {
    method: "POST",
    body: JSON.stringify({
      kind,
      filename: file.name,
      mime: file.type,
      size: file.size,
      consent: true,
      duration: kind === "voice" ? await duration(file) : undefined,
    }),
  });
  try {
    onProgress(10);
    const { error } = await browserSupabase()
      .storage.from(ticket.bucket)
      .uploadToSignedUrl(ticket.path, ticket.token, file, {
        contentType: file.type,
      });
    if (error) throw error;
    onProgress(90);
    await api(`/api/v1/personas/${personaId}/asset`, {
      method: "POST",
      body: JSON.stringify({
        kind,
        assetId: ticket.assetId,
        operation: "complete",
      }),
    });
    onProgress(100);
  } catch (e) {
    await api(`/api/v1/personas/${personaId}/asset`, {
      method: "POST",
      body: JSON.stringify({
        kind,
        assetId: ticket.assetId,
        operation: "remove",
      }),
    }).catch(() => {});
    throw e;
  }
}
