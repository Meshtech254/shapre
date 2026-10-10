import { Suspense } from "react";
import { demoLibrary } from "@/lib/demo-personas/server";
import { requireUser } from "@/lib/auth/server";
import { check } from "@/lib/api";
import { Studio } from "@/components/studio/studio";
import { mockMode } from "@/lib/env";
import type { Persona } from "@/types";
import { thumbnails, personaColumns } from "@/lib/personas";
import { getUserEntitlements, platformSettings } from "@/lib/platform/server";
export default function StudioPage() {
  return (
    <Suspense
      fallback={
        <div className="stack">
          <h1>Your streaming studio</h1>
          <div className="preview">
            <p>Loading Studio preferences...</p>
          </div>
        </div>
      }
    >
      <StudioData />
    </Suspense>
  );
}
async function StudioData() {
  const { db, user } = await requireUser();
  const [ps, profile, demos, policy, platform] = await Promise.all([
    db
      .from("personas")
      .select(personaColumns)
      .order("created_at", { ascending: false }),
    db.from("profiles").select("streaming_defaults").eq("id", user.id).single(),
    demoLibrary(),
    getUserEntitlements(user.id),
    platformSettings(),
  ]);
  check(ps.error);
  check(profile.error);
  const personas = ps.data as Persona[];
  const urls = personas.length ? await thumbnails(db, personas) : {};
  return (
    <Studio
      personas={personas}
      demos={demos}
      mock={mockMode}
      urls={urls}
      deviceDefaults={profile.data?.streaming_defaults ?? {}}
      policy={policy}
      outputOptions={{
        resolutions: platform["stream.resolutions"],
        fps: platform["stream.fps"],
      }}
    />
  );
}
