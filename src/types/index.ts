export type AssetStatus =
  "missing" | "uploaded" | "processing" | "ready" | "failed";
export interface Persona {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  status: "draft" | "preparing" | "ready" | "failed";
  face_status: AssetStatus;
  voice_status: AssetStatus;
  moderation_status: string;
  consent_face_confirmed_at: string | null;
  consent_voice_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}
export interface Asset {
  id: string;
  persona_id: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  duration_seconds?: number | null;
  url?: string;
}
export interface LiveSession {
  id: string;
  persona_id: string | null;
  demo_persona_id?: string | null;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number;
  latency_ms: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
