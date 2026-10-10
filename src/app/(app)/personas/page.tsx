import { DemoLibrary } from "@/components/demo-personas/library";
import { demoLibrary } from "@/lib/demo-personas/server";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/server";
import { check } from "@/lib/api";
import { thumbnails, personaColumns } from "@/lib/personas";
import { Heading, EmptyPersonas } from "@/components/ui";
import { PersonaCard } from "@/components/personas/persona-card";
import type { Persona } from "@/types";
export default async function Personas() {
  const { db } = await requireUser();
  const demosPromise = demoLibrary();
  const { data, error } = await db
    .from("personas")
    .select(personaColumns)
    .order("created_at", { ascending: false });
  check(error);
  const ps = data as Persona[];
  const urls = ps.length ? await thumbnails(db, ps) : {};
  const demos = await demosPromise;
  return (
    <>
      <Heading
        title="Your personas"
        description="A collection of identities, made for your creative world."
      >
        <Link href="/personas/new" className="btn primary">
          <Plus size={16} />
          Create persona
        </Link>
      </Heading>
      {ps.length ? (
        <div className="grid3">
          {ps.map((p) => (
            <PersonaCard key={p.id} persona={p} url={urls[p.id]} />
          ))}
        </div>
      ) : (
        <EmptyPersonas />
      )}
      <div id="demos" style={{ marginTop: 48 }}>
        <DemoLibrary personas={demos} />
      </div>
    </>
  );
}
