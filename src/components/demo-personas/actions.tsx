"use client";
import Link from "next/link";
import { useEffect } from "react";
import { trackDemo } from "@/lib/demo-personas/analytics";
export function DemoActions({ slug }: { slug: string }) {
  useEffect(() => {
    trackDemo("demo_persona_viewed", slug);
  }, [slug]);
  return (
    <div className="row">
      <Link
        className="btn primary"
        href={`/studio?demoPersona=${slug}`}
        onClick={() => trackDemo("demo_persona_selected", slug)}
      >
        Try in Studio
      </Link>
      <Link
        className="btn"
        href="/personas/new"
        onClick={() => trackDemo("demo_to_custom_persona_clicked", slug)}
      >
        Create My Own Persona
      </Link>
    </div>
  );
}
