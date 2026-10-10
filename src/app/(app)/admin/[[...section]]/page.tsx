import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/server";
import {
  requireAdmin,
  platformSettings,
  getUserEntitlements,
} from "@/lib/platform/server";
import { admin } from "@/lib/supabase/admin";
import { check } from "@/lib/api";
import {
  AdminMutation,
  EntitlementControl,
  TestNormalUser,
  AvatarUpload,
} from "@/components/admin/controls";
import { type SettingKey } from "@/lib/platform/schema";
import { demoInput } from "@/lib/platform/admin-input";
export default async function AdminPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section = [] } = await params,
    { user } = await requireUser(),
    role = await requireAdmin(user.id),
    service = admin();
  const [page, id] = section;
  if (section.length > 2) notFound();
  if (!page) {
    const policy = await getUserEntitlements(user.id);
    const counts = await Promise.all(
      ["profiles", "personas", "live_sessions", "demo_personas"].map((table) =>
        service.from(table).select("id", { head: true, count: "exact" }),
      ),
    );
    counts.forEach((x) => check(x.error));
    return (
      <div className="stack">
        <p>
          Signed in as {role}. Product entitlements are separate from security
          limits.
        </p>
        <TestNormalUser enabled={policy.testing} />
        <div className="grid3">
          {counts.map((x, i) => (
            <div className="card" key={i}>
              <h3>{["Users", "Personas", "Sessions", "Demo personas"][i]}</h3>
              <p>{x.count}</p>
            </div>
          ))}
        </div>
        <h2>Recent audit log</h2>
        <Records table="admin_audit_logs" />
      </div>
    );
  }
  if (page === "users") {
    if (id) {
      const result = await service
        .from("profiles")
        .select("*")
        .eq("id", id)
        .single();
      check(result.error);
      if (!result.data) notFound();
      const [account, overrides, auth] = await Promise.all([
        service
          .from("credit_accounts")
          .select("*")
          .eq("user_id", id)
          .maybeSingle(),
        service.from("user_entitlements").select("*").eq("user_id", id),
        service.auth.admin.getUserById(id),
      ]);
      check(account.error);
      check(overrides.error);
      check(auth.error);
      const roleResult = await service
        .from("user_roles")
        .select("role")
        .eq("user_id", id)
        .maybeSingle();
      check(roleResult.error);
      return (
        <div className="stack">
          <h2>{auth.data.user?.email ?? result.data.display_name ?? id}</h2>
          <p>
            User {id} · Credit balance {account.data?.balance ?? 0} streaming
            minutes · Trials used {account.data?.trial_uses ?? 0}
          </p>
          {role === "super_admin" && (
            <div className="grid3">
              <div className="card stack">
                <h3>Credits</h3>
                <AdminMutation
                  operation="credits"
                  target={id}
                  initial={{ mode: "adjust", amount: 30 }}
                  label="Adjust credits"
                />
                <AdminMutation
                  operation="credits"
                  target={id}
                  initial={{ mode: "set", amount: 0 }}
                  label="Set balance"
                  destructive
                />
              </div>
              <div className="card stack">
                <h3>Trials and entitlements</h3>
                <AdminMutation
                  operation="trial_reset"
                  target={id}
                  initial={{}}
                  label="Reset trial"
                  destructive
                />
                <EntitlementControl id={id} />
              </div>
              <div className="card">
                <h3>Role</h3>
                <AdminMutation
                  operation="role"
                  target={id}
                  initial={{ role: roleResult.data?.role ?? "user" }}
                  label="Change role"
                  destructive
                />
              </div>
            </div>
          )}
          <h3>Existing overrides</h3>
          <pre>{JSON.stringify(overrides.data, null, 2)}</pre>
          <h3>Audit history</h3>
          <Records table="admin_audit_logs" target={id} />
        </div>
      );
    }
    const result = await service
      .from("profiles")
      .select("id,display_name,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    check(result.error);
    return (
      <div className="card stack">
        <h2>Users</h2>
        <p>Latest 100 accounts</p>
        {result.data?.map((p) => (
          <Link key={p.id} href={`/admin/users/${p.id}`}>
            {p.display_name || p.id}
          </Link>
        ))}
      </div>
    );
  }
  if (["limits", "pricing", "trials"].includes(page)) {
    const settings = await platformSettings();
    const entries = Object.entries(settings).filter(([key]) =>
      page === "pricing"
        ? key.startsWith("pricing.") || key.startsWith("plans.")
        : page === "trials"
          ? key.startsWith("trial.")
          : !key.startsWith("pricing.") && !key.startsWith("plans."),
    );
    return (
      <div className="stack">
        <h2>{page}</h2>
        {page === "pricing" && (
          <p>
            Prices are display configuration. Credit adjustments use
            streaming-minute credits; no payment checkout is configured.
          </p>
        )}
        <div className="grid3">
          {entries.map(([key, value]) => (
            <div className="card stack" key={key}>
              <h3>{key}</h3>
              {role === "super_admin" ? (
                <AdminMutation
                  operation="setting"
                  target={key}
                  initial={{ value: settings[key as SettingKey] }}
                />
              ) : (
                <pre>{JSON.stringify(value, null, 2)}</pre>
              )}
            </div>
          ))}
        </div>
        {page === "trials" && (
          <>
            <h3>Recent trials</h3>
            <Records table="demo_trials" />
          </>
        )}
      </div>
    );
  }
  if (page === "demo-personas") {
    const result = await service
      .from("demo_personas")
      .select("*")
      .order("sort_order")
      .limit(120);
    check(result.error);
    const blank = {
      name: "New original persona",
      slug: `persona-${crypto.randomUUID().slice(0, 8)}`,
      description: "Original synthetic adult streaming persona",
      category: "realistic",
      style: "realistic",
      thumbnail_url: "/demos/amara/thumbnail.webp",
      preview_image_url: "/demos/amara/preview.webp",
      studio_avatar_url: "/demos/amara/studio.webp",
      face_source_reference: null,
      face_asset_reference: null,
      voice_asset_reference: null,
      active: false,
      featured: false,
      sort_order: 100,
      inference_ready: false,
      face_ready: false,
      voice_ready: false,
      metadata: {
        placeholder: false,
        avatar_ready: true,
        ownership: "Original synthetic adult identity",
        asset_license: "Shapre original artwork",
      },
      tags: [],
      gender_presentation: null,
    };
    return (
      <div className="stack">
        <h2>Demo personas</h2>
        <p>
          Keep identities consistent across image roles. Enable inference only
          after validating real worker output.
        </p>
        <details className="card">
          <summary>Create demo persona</summary>
          <AdminMutation
            operation="demo"
            target={crypto.randomUUID()}
            initial={blank}
            label="Create demo"
          />
        </details>
        {result.data?.map((p) => (
          <details className="card" key={p.id}>
            <summary>
              {p.name} · {p.active ? "Active" : "Inactive"} ·{" "}
              {p.inference_ready ? "Inference ready" : "Model unprepared"}
            </summary>
            {p.metadata.placeholder && (
              <p>
                Unpublished concept. Upload a complete avatar bundle before
                activating it.
              </p>
            )}
            <div className="grid3">
              <AdminMutation
                operation="demo"
                target={p.id}
                initial={demoInput.parse({
                  ...p,
                  studio_avatar_url: p.studio_avatar_url ?? p.preview_image_url,
                  metadata: {
                    ...p.metadata,
                    placeholder: false,
                    avatar_ready: true,
                  },
                })}
                label="Save demo"
              />
              <AvatarUpload id={p.id} />
            </div>
          </details>
        ))}
      </div>
    );
  }
  if (page === "sessions") {
    const result = await service
      .from("live_sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    check(result.error);
    return (
      <div className="stack">
        <h2>Sessions</h2>
        <p>Latest 100 sessions. Refresh this page for current state.</p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                {[
                  "User / persona",
                  "Status",
                  "Duration",
                  "Credits",
                  "Quality",
                  "Latency / inference",
                  "Errors / control",
                ].map((x) => (
                  <th key={x}>{x}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.data?.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/admin/users/${s.user_id}`}>{s.user_id}</Link>
                    <br />
                    {s.demo_persona_id
                      ? `Demo ${s.demo_persona_id}`
                      : `Custom ${s.persona_id}`}
                    <br />
                    {s.started_at ?? s.created_at}
                  </td>
                  <td>{s.status}</td>
                  <td>{s.duration_seconds}s</td>
                  <td>{s.metadata.credits_used ?? 0}</td>
                  <td>{s.metadata.settings?.quality}</td>
                  <td>
                    {s.latency_ms ?? "—"} ms
                    <br />
                    {s.metadata.mock
                      ? "Mock"
                      : s.inference_session_id
                        ? "Worker"
                        : "Pending"}
                  </td>
                  <td>
                    {s.metadata.error ?? ""}
                    {role === "super_admin" &&
                      ["initializing", "connected", "live"].includes(
                        s.status,
                      ) && (
                        <AdminMutation
                          operation="stop_session"
                          target={s.id}
                          initial={{}}
                          label="Stop session"
                          destructive
                        />
                      )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  if (page === "analytics")
    return (
      <div className="stack">
        <h2>Analytics</h2>
        <p>Latest 100 events. Started/completed events are server-owned.</p>
        <Records table="demo_analytics" />
      </div>
    );
  notFound();
}
async function Records({ table, target }: { table: string; target?: string }) {
  let query = admin()
    .from(table)
    .select("*")
    .order(table === "demo_trials" ? "started_at" : "created_at", {
      ascending: false,
    })
    .limit(100);
  if (target) query = query.eq("target_id", target);
  const result = await query;
  check(result.error);
  return (
    <pre style={{ overflowX: "auto", fontSize: 12 }}>
      {JSON.stringify(result.data, null, 2)}
    </pre>
  );
}
