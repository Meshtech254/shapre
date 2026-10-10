"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Radio,
  Settings,
  CreditCard,
  LogOut,
  ArrowUpRight,
} from "lucide-react";
import { Brand } from "@/components/ui";
import { browserSupabase } from "@/lib/supabase/browser";
import { toast } from "sonner";
const links = [
  ["/dashboard", "Overview", LayoutDashboard],
  ["/personas", "My personas", Users],
  ["/studio", "Streaming studio", Radio],
  ["/settings", "Settings", Settings],
  ["/billing", "Billing", CreditCard],
] as const;
export function AppShell({
  children,
  email,
  admin = false,
}: {
  children: React.ReactNode;
  email: string;
  admin?: boolean;
}) {
  const path = usePathname();
  const router = useRouter();
  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand />
        <div>
          <div className="eyebrow" style={{ margin: "0 11px 16px" }}>
            Workspace
          </div>
          <nav className="nav">
            {admin && (
              <Link
                href="/admin"
                className={path.startsWith("/admin") ? "active" : ""}
              >
                <Settings size={18} />
                <span>Administration</span>
              </Link>
            )}
            {links.map(([href, label, Icon]) => (
              <Link
                className={path.startsWith(href) ? "active" : ""}
                href={href}
                key={href}
              >
                <Icon size={18} />
                <span>{label}</span>
              </Link>
            ))}
          </nav>
        </div>
        <div className="sidebar-bottom">
          <div className="notice">
            Your identity. Your stage.
            <br />
            <Link href="/legal/acceptable-use">
              Create responsibly{" "}
              <ArrowUpRight size={12} style={{ display: "inline" }} />
            </Link>
          </div>
          <Link
            className="muted"
            href={`mailto:${process.env.NEXT_PUBLIC_ABUSE_EMAIL ?? "abuse@example.com"}`}
          >
            Report abuse
          </Link>
          <button
            className="btn small"
            onClick={async () => {
              const { error } = await browserSupabase().auth.signOut();
              if (error) toast.error(error.message);
              else {
                router.push("/login");
                router.refresh();
              }
            }}
          >
            <LogOut size={14} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <span>
            Creator workspace{" "}
            <span style={{ color: "#50515a", margin: "0 10px" }}>/</span>{" "}
            {links.find(([href]) => path.startsWith(href))?.[1] ?? "Shapre"}
          </span>
          <span className="row">
            <span className="badge">Early access</span>
            <span className="muted">{email}</span>
          </span>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
