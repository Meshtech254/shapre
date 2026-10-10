import Link from "next/link";
import { Fingerprint, Plus } from "lucide-react";
export function Brand() {
  return (
    <Link href="/" className="brand">
      <span className="brand-mark" />
      <span>
        shapre<span style={{ color: "var(--accent)" }}>.</span>
      </span>
    </Link>
  );
}
export function Badge({ status }: { status: string }) {
  return <span className={`badge ${status}`}>{status}</span>;
}
export function EmptyPersonas() {
  return (
    <div className="card empty">
      <div className="empty-icon">
        <Fingerprint size={30} />
      </div>
      <h2>Your next identity starts here.</h2>
      <p>
        Create a persona using face images and a voice you have permission to
        use.
      </p>
      <Link className="btn primary" href="/personas/new">
        <Plus size={16} />
        Create your first persona
      </Link>
    </div>
  );
}
export function Heading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
