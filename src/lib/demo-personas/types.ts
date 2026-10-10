export interface DemoPersona {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  style: string;
  preview_image_url: string;
  thumbnail_url: string;
  studio_avatar_url?: string | null;
  mock_available?: boolean;
  gender_presentation: string | null;
  tags: string[];
  active: boolean;
  featured: boolean;
  sort_order: number;
  inference_ready: boolean;
  face_ready: boolean;
  voice_ready: boolean;
  metadata: {
    placeholder?: boolean;
    voice_profile?: string | null;
    ownership?: string;
    asset_license?: string;
    avatar_ready?: boolean;
    asset_bundle_version?: number;
  };
}
export function demoAvailable(
  persona: Pick<
    DemoPersona,
    "active" | "inference_ready" | "face_ready" | "metadata"
  >,
) {
  return (
    persona.active &&
    ((persona.inference_ready && persona.face_ready) ||
      ("mock_available" in persona && persona.mock_available === true)) &&
    !persona.metadata.placeholder
  );
}
export const demoColumns =
  "id,name,slug,description,category,style,preview_image_url,thumbnail_url,studio_avatar_url,gender_presentation,tags,active,featured,sort_order,inference_ready,face_ready,voice_ready,metadata";
export function hasAvatar(persona: DemoPersona) {
  return (
    !persona.metadata.placeholder &&
    !!persona.thumbnail_url &&
    !!persona.preview_image_url &&
    !!persona.studio_avatar_url
  );
}
