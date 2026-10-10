import "server-only";
import { unstable_cache } from "next/cache";
import { admin } from "@/lib/supabase/admin";
import seed from "../../../supabase/seed/demo-personas.json";
import { demoColumns, type DemoPersona } from "./types";
import { avatarCatalog } from "./catalog";
import { mockMode } from "@/lib/env";
import { platformSettings } from "@/lib/platform/server";
export const demoLibrary = unstable_cache(
  async (): Promise<DemoPersona[]> => {
    let { data, error } = await admin()
      .from("demo_personas")
      .select(demoColumns)
      .eq("active", true)
      .order("sort_order")
      .limit(120);
    if (error?.code === "42703" || error?.code === "PGRST204") {
      const legacy = await admin()
        .from("demo_personas")
        .select(demoColumns.replace(",studio_avatar_url", ""))
        .eq("active", true)
        .order("sort_order")
        .limit(120);
      data = legacy.data as typeof data;
      error = legacy.error;
    }
    // Let local UI work before migration, but never bypass DB activation/readiness.
    if (error?.code === "42P01" || error?.code === "PGRST205")
      return avatarCatalog(seed as DemoPersona[]);
    if (error)
      throw new Error("Demo library could not be loaded. Please retry.");
    const settings = await platformSettings();
    if (!settings["demo.enabled"]) return [];
    return avatarCatalog(data as DemoPersona[]).map((p, index) => ({
      ...p,
      featured: p.featured && index < settings["demo.featured_count"],
      mock_available: mockMode && hasSource(p.slug, p.metadata.avatar_ready),
    }));
  },
  ["demo-library-avatars-v2", mockMode ? "mock" : "worker"],
  { revalidate: 60, tags: ["demo-personas"] },
);
function hasSource(slug: string, avatarReady?: boolean) {
  return (
    !!avatarReady &&
    seed.some((p) => p.slug === slug && !!p.face_source_reference)
  );
}
