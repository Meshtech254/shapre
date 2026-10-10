import Link from "next/link";
export default function NotFound() {
  return (
    <div className="legal stack">
      <h1>This page is off air.</h1>
      <p>The page or persona could not be found.</p>
      <Link className="btn primary" href="/dashboard">
        Back to dashboard
      </Link>
    </div>
  );
}
