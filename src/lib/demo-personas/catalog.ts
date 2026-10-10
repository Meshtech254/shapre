import seed from "../../../supabase/seed/demo-personas.json";
import { hasAvatar, type DemoPersona } from "./types";
const bundled = new Map(seed.map((p) => [p.slug, p]));
/** Upgrade legacy concept art locally while preserving configured admin identities. */
export function avatarCatalog(personas: DemoPersona[]): DemoPersona[] {
  return personas
    .map((persona) => {
      const asset = bundled.get(persona.slug);
      if (persona.metadata.placeholder && asset?.metadata.avatar_ready) {
        return {
          ...persona,
          description: asset.description,
          thumbnail_url: asset.thumbnail_url,
          preview_image_url: asset.preview_image_url,
          studio_avatar_url: asset.studio_avatar_url,
          featured: true,
          metadata: {
            ...persona.metadata,
            placeholder: false,
            avatar_ready: true,
            asset_bundle_version: 1,
          },
        };
      }
      return persona;
    })
    .filter((persona) => persona.active && hasAvatar(persona));
}
