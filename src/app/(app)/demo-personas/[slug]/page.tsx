import Image from "next/image";
import { notFound } from "next/navigation";
import { demoLibrary } from "@/lib/demo-personas/server";
import { demoAvailable } from "@/lib/demo-personas/types";
import { DemoActions } from "@/components/demo-personas/actions";
export default async function DemoPreview({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const persona = (await demoLibrary()).find((p) => p.slug === slug);
  if (!persona) notFound();
  return (
    <div className="demo-detail">
      <div className="card persona-art">
        <Image
          src={persona.preview_image_url}
          alt={`${persona.name}, original synthetic Shapre avatar`}
          width={896}
          height={896}
          priority
          sizes="(max-width: 800px) 90vw, 45vw"
          unoptimized={persona.preview_image_url.endsWith(".svg")}
        />
      </div>
      <div className="stack">
        <span className="badge">Shapre Demo Persona</span>
        <h1>{persona.name}</h1>
        <p>{persona.description}</p>
        <div className="row">
          <span className="badge">{persona.category}</span>
          <span className="badge">
            {persona.mock_available
              ? "Available · Mock"
              : demoAvailable(persona)
                ? "Available now"
                : "Preview only"}
          </span>
        </div>
        <p>Style: {persona.style.replaceAll("-", " ")}</p>
        {persona.mock_available && (
          <p>
            Ready to use in a development session. Mock output uses your
            original camera; real transformation requires a configured worker.
          </p>
        )}
        <p>
          {persona.voice_ready
            ? "Synthetic demo voice included"
            : "Use your normal microphone. No demo voice asset is configured."}
        </p>
        {!demoAvailable(persona) && (
          <div className="notice">
            This avatar portrait is ready to preview in Studio. Live
            transformation is unavailable until its face model is prepared by
            the inference worker.
          </div>
        )}
        <DemoActions slug={slug} />
      </div>
    </div>
  );
}
