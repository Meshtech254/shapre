import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Persona } from "@/types";
export const personaColumns =
  "id,user_id,name,description,thumbnail_url,status,face_status,voice_status,moderation_status,consent_face_confirmed_at,consent_voice_confirmed_at,created_at,updated_at";
export async function thumbnails(db: SupabaseClient, personas: Persona[]) {
  const { data } = await db
    .from("persona_face_assets")
    .select("persona_id,storage_path,metadata")
    .in(
      "persona_id",
      personas.map((p) => p.id),
    )
    .order("sort_order");
  const urls: Record<string, string> = {};
  const selected = new Map<string, string>();
  for (const asset of data ?? []) {
    if (!selected.has(asset.persona_id) && asset.metadata?.uploaded)
      selected.set(asset.persona_id, asset.storage_path);
  }
  const paths = [...selected.values()];
  if (paths.length) {
    const { data: signed } = await db.storage
      .from("persona-faces")
      .createSignedUrls(paths, 900);
    const signedPaths = new Map(
      (signed ?? []).map((item) => [item.path, item.signedUrl]),
    );
    selected.forEach((path, id) => {
      const url = signedPaths.get(path);
      if (url) urls[id] = url;
    });
  }
  return urls;
}
