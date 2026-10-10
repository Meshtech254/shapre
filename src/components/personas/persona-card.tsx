import Link from "next/link";
import Image from "next/image";
import { Fingerprint, ArrowUpRight } from "lucide-react";
import type { Persona } from "@/types";
import { Badge } from "@/components/ui";
export function PersonaCard({
  persona,
  url,
}: {
  persona: Persona;
  url?: string;
}) {
  return (
    <Link href={`/personas/${persona.id}`} className="card persona-card">
      <div className="persona-art">
        {url ? (
          <Image
            src={url}
            alt={persona.name}
            width={360}
            height={360}
            sizes="(max-width: 700px) 90vw, 30vw"
          />
        ) : (
          <Fingerprint size={70} strokeWidth={1} />
        )}
      </div>
      <div className="info">
        <div className="row between">
          <h3>{persona.name}</h3>
          <ArrowUpRight size={16} className="muted" />
        </div>
        <div style={{ marginTop: 8 }}>
          <Badge status={persona.status} />
        </div>
        <div className="status-row">
          <span>Face · {persona.face_status}</span>
          <span>Voice · {persona.voice_status}</span>
        </div>
      </div>
    </Link>
  );
}
