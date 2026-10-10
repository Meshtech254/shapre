import { DemoLibrary } from "@/components/demo-personas/library";
import { demoLibrary } from "@/lib/demo-personas/server";
import Link from "next/link";
import { Plus, Radio, ArrowUpRight } from "lucide-react";
import { requireUser } from "@/lib/auth/server";
import { check } from "@/lib/api";
import { thumbnails, personaColumns } from "@/lib/personas";
import { PersonaCard } from "@/components/personas/persona-card";
import { Badge, EmptyPersonas, Heading } from "@/components/ui";
import type { Persona, LiveSession } from "@/types";
import { plans, type Plan } from "@/config/plans";
export default async function Dashboard() {
  const { db, user } = await requireUser();
  const month = new Date();
  month.setUTCDate(1);
  month.setUTCHours(0, 0, 0, 0);
  const [ps, ss, profile, sub, usage, demos] = await Promise.all([
    db
      .from("personas")
      .select(personaColumns)
      .order("created_at", { ascending: false }),
    db
      .from("live_sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5),
    db.from("profiles").select("display_name").eq("id", user.id).single(),
    db.from("subscriptions").select("plan").eq("user_id", user.id).single(),
    db
      .from("usage_events")
      .select("quantity")
      .eq("event_type", "stream_minutes")
      .gte("created_at", month.toISOString()),
    demoLibrary(),
  ]);
  [ps.error, ss.error, profile.error, sub.error, usage.error].forEach(check);
  const personas = ps.data as Persona[];
  const sessions = ss.data as LiveSession[];
  const urls = personas.length ? await thumbnails(db, personas) : {};
  const plan = plans[(sub.data?.plan ?? "free") as Plan] ?? plans.free;
  return (
    <div className="stack">
      <Heading
        title={`Welcome${profile.data?.display_name ? `, ${profile.data.display_name}` : " to Shapre"}.`}
        description="Your identities, your sessions, your next creative chapter."
      >
        <Link className="btn primary" href="/studio">
          <Radio size={17} />
          Go Live <ArrowUpRight size={15} />
        </Link>
      </Heading>
      {!personas.length && <DemoLibrary personas={demos} featured />}
      <div className="stat-grid">
        {[
          ["Total personas", String(personas.length)],
          [
            "Live minutes this month",
            String(
              Math.ceil(
                (usage.data ?? []).reduce((n, e) => n + Number(e.quantity), 0),
              ),
            ),
          ],
          ["Current plan", plan.name],
          [
            "Last studio session",
            sessions[0]
              ? new Date(sessions[0].created_at).toLocaleDateString("en", {
                  month: "short",
                  day: "numeric",
                })
              : "Not yet",
          ],
        ].map(([label, value]) => (
          <div className="card stat" key={label}>
            <span className="muted">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div
        className="card row between"
        style={{
          background: "linear-gradient(115deg,#202a1c,#15171a)",
          padding: 30,
        }}
      >
        <div>
          <span className="eyebrow">Ready when you are</span>
          <h2 style={{ marginTop: 9 }}>A new presence. The same you.</h2>
          <p style={{ marginTop: 6 }}>
            Build your identity and bring it into your studio.
          </p>
        </div>
        <Link href="/personas/new" className="btn">
          <Plus size={16} />
          New persona
        </Link>
      </div>
      <div className="row between" style={{ marginTop: 10 }}>
        <h2>Your personas</h2>
        <Link className="muted" href="/personas">
          View all ↗
        </Link>
      </div>
      {personas.length ? (
        <div className="grid3">
          {personas.slice(0, 3).map((p) => (
            <PersonaCard key={p.id} persona={p} url={urls[p.id]} />
          ))}
        </div>
      ) : (
        <EmptyPersonas />
      )}
      <h2 style={{ marginTop: 14 }}>Recent sessions</h2>
      <div className="card table-wrap">
        {sessions.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Persona</th>
                <th>Started</th>
                <th>Duration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>
                    {personas.find((p) => p.id === s.persona_id)?.name ??
                      demos.find((p) => p.id === s.demo_persona_id)?.name ??
                      "Persona"}
                  </td>
                  <td>{new Date(s.created_at).toLocaleString()}</td>
                  <td>{Math.ceil(s.duration_seconds / 60)} min</td>
                  <td>
                    <Badge status={s.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty">
            <Radio className="muted" size={26} />
            <h3>Your first broadcast is ahead of you.</h3>
            <p>Your studio sessions will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
