"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  demoAvailable,
  hasAvatar,
  type DemoPersona,
} from "@/lib/demo-personas/types";
export function DemoLibrary({
  personas,
  featured = false,
}: {
  personas: DemoPersona[];
  featured?: boolean;
}) {
  const [category, setCategory] = useState("all");
  const [limit, setLimit] = useState(12);
  const filtered = personas.filter(
    (p) =>
      (!featured || p.featured) &&
      p.active &&
      hasAvatar(p) &&
      (category === "all" || p.category === category),
  );
  return (
    <section className="stack demo-library">
      <div>
        <span className="eyebrow">SHAPRE ORIGINALS</span>
        <h2>{featured ? "Try Shapre instantly" : "Try a Demo Persona"}</h2>
        <p>
          Choose a demo persona and see how live transformation works before
          creating your own.
        </p>
      </div>
      {!featured && (
        <div className="row demo-filters" aria-label="Demo categories">
          {[
            "all",
            "realistic",
            "cyborg",
            "cartoon",
            "sci-fi",
            "fantasy",
            "anime",
            "robot",
          ].map((c) => (
            <button
              key={c}
              className={`btn small ${category === c ? "primary" : ""}`}
              aria-pressed={category === c}
              onClick={() => {
                setCategory(c);
                setLimit(12);
              }}
            >
              {c === "sci-fi" ? "Sci-Fi" : c[0].toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      )}
      <div className="grid3">
        {filtered.slice(0, featured ? 6 : limit).map((p, index) => (
          <Link
            key={p.id}
            href={`/demo-personas/${p.slug}`}
            prefetch={false}
            className="card persona-card demo-card"
          >
            <div className="persona-art">
              <Image
                src={p.thumbnail_url}
                alt={`${p.name}, Shapre original ${p.metadata.placeholder ? "concept placeholder" : "demo persona"}`}
                width={384}
                height={384}
                priority={featured && index < 3}
                sizes="(max-width: 700px) 90vw, (max-width: 1100px) 40vw, 30vw"
                unoptimized={p.thumbnail_url.endsWith(".svg")}
              />
              <span className="badge demo-indicator">Shapre Demo Persona</span>
            </div>
            <div className="info">
              <div className="row between">
                <h3>{p.name}</h3>
                <span className="badge">{p.category}</span>
              </div>
              <p className="demo-descriptor">{p.description}</p>
              <div className="row">
                <span className={`badge ${demoAvailable(p) ? "ready" : ""}`}>
                  {p.mock_available
                    ? "Available · Mock"
                    : demoAvailable(p)
                      ? "Available now"
                      : "Preview only"}
                </span>
                {p.voice_ready && <span className="badge">Voice included</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
      {!filtered.length && (
        <p className="notice">No published avatars in this category yet.</p>
      )}
      {!featured && filtered.length > limit && (
        <button className="btn" onClick={() => setLimit((n) => n + 12)}>
          Show more demos
        </button>
      )}
      {featured && (
        <div className="row">
          <Link className="btn primary" href="/personas#demos">
            Try Demo
          </Link>
          <Link className="btn" href="/personas/new">
            Create My Persona
          </Link>
        </div>
      )}
    </section>
  );
}
