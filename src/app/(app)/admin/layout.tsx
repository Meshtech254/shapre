import { requireUser } from "@/lib/auth/server";
import { requireAdmin } from "@/lib/platform/server";
import Link from "next/link";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireUser();
  await requireAdmin(user.id);
  return (
    <div className="stack">
      <h1>Platform administration</h1>
      <nav className="row" aria-label="Admin navigation">
        {[
          "",
          "users",
          "limits",
          "pricing",
          "trials",
          "demo-personas",
          "sessions",
          "analytics",
        ].map((x) => (
          <Link
            className="btn small"
            key={x}
            href={`/admin${x ? `/${x}` : ""}`}
          >
            {x ? x.replaceAll("-", " ") : "Overview"}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
