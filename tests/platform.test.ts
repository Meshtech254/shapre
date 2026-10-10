import { test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { validateChanges } from "../src/lib/platform/admin-input";
const db = new PGlite();
const user = "00000000-0000-4000-8000-000000000001",
  founder = "00000000-0000-4000-8000-000000000002";
const atlas = "a1000000-0000-4000-8000-000000000014";
let demoId: string;
async function value<T>(sql: string, params: unknown[] = []) {
  return (await db.query<{ v: T }>(sql, params)).rows[0]?.v;
}
async function rejects(run: () => Promise<unknown>, pattern: RegExp) {
  await db.exec("savepoint expected_failure");
  await assert.rejects(run(), pattern);
  await db.exec("rollback to expected_failure;release expected_failure");
}
before(
  async () => {
    await db.exec(`create role anon;create role authenticated;create role service_role;
  create schema auth;create schema storage;
  create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid primary key,bucket_id text,name text);
  create function storage.foldername(text) returns text[] language sql as $$ select string_to_array($1,'/') $$;
  grant usage on schema public,auth,storage to authenticated,anon,service_role;grant execute on function auth.uid() to authenticated;`);
    for (const file of [
      "202610070001_shapre.sql",
      "202610070002_demo_personas.sql",
      "202610070003_demo_avatar_assets.sql",
      "202610070004_platform_control.sql",
      "202610070005_platform_procedures.sql",
    ]) {
      let sql = await readFile(`supabase/migrations/${file}`, "utf8");
      sql = sql.replace(/create extension if not exists pgcrypto;/i, "");
      await db.exec(sql);
    }
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at) values($1,'normal@test.invalid',now()),($2,'founder@test.invalid',now())",
      [user, founder],
    );
    await db.query("select public.bootstrap_platform_owner($1)", [founder]);
    demoId = (
      await db.query<{ id: string }>(
        "select id from public.demo_personas where slug='atlas'",
      )
    ).rows[0].id;
  },
  { timeout: 60000 },
);
after(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.exec("begin");
});
afterEach(async () => {
  await db.exec("rollback");
});
const settings = {
  quality: "Balanced",
  voiceEnabled: false,
  faceEnabled: true,
};
async function reserve(owner = user, test = false, mock = true) {
  return value<{ id: string; metadata: Record<string, unknown> }>(
    "select to_jsonb(public.reserve_studio_session($1,null,$2,$3,$4)) as v",
    [owner, demoId, { settings, mock }, test],
  );
}
test("founder bypass and normal-user simulation retain the real authorization role", async () => {
  const p = await value<Record<string, unknown>>(
    "select public.resolve_product_policy($1,false) as v",
    [founder],
  );
  assert.equal(p.unlimited_credits, true);
  assert.equal(p.bypass_trial_limit, true);
  const normal = await value<Record<string, unknown>>(
    "select public.resolve_product_policy($1,true) as v",
    [founder],
  );
  assert.equal(normal.role, "super_admin");
  assert.equal(normal.unlimited_credits, false);
  assert.equal(normal.testing, true);
  const session = await reserve(founder);
  assert.equal(session.metadata.trial, false);
  assert.equal(session.metadata.max_duration_seconds, 86400);
});
test("mock avatars create real capped sessions, reject overlaps and release failed setup trials", async () => {
  const session = await reserve();
  assert.equal(session.metadata.trial, true);
  assert.equal(session.metadata.max_duration_seconds, 60);
  await rejects(() => reserve(), /Concurrent/);
  await db.query("select public.finish_session($1)", [session.id]);
  const retry = await reserve();
  assert.ok(retry.id);
  await db.query(
    "update public.live_sessions set started_at=now(),status='connected' where id=$1",
    [retry.id],
  );
  await db.query("select public.finish_session($1)", [retry.id]);
  await rejects(() => reserve(), /already used/);
  assert.equal(
    await value<number>(
      "select count(*)::int as v from public.demo_analytics where event='demo_trial_completed'",
    ),
    1,
  );
});
test("real modes reject unprepared artwork instead of faking model readiness", async () => {
  await rejects(() => reserve(user, false, false), /face model/);
});
test("analytics limiter supports its action and ignores caller attempts to enlarge limits", async () => {
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [user]);
  for (let i = 0; i < 30; i++)
    assert.equal(
      await value<boolean>(
        "select public.consume_rate_limit('demo-analytics',999999,1) as v",
      ),
      true,
    );
  assert.equal(
    await value<boolean>(
      "select public.consume_rate_limit('demo-analytics',999999,1) as v",
    ),
    false,
  );
  assert.equal(
    await value<boolean>(
      "select public.consume_rate_limit('unknown',99,1) as v",
    ),
    false,
  );
});
test("only privileged roles can mutate audited controls; expiry and precedence work", async () => {
  await rejects(
    () =>
      db.query(
        "select public.admin_mutate($1,'credits',$2,'{\"mode\":\"adjust\",\"amount\":10}','test credit')",
        [user, user],
      ),
    /Administrator/,
  );
  await db.query(
    "select public.admin_mutate($1,'credits',$2,'{\"mode\":\"adjust\",\"amount\":10}','test credit')",
    [founder, user],
  );
  assert.equal(
    await value<number>(
      "select balance::int as v from public.credit_accounts where user_id=$1",
      [user],
    ),
    10,
  );
  assert.equal(
    await value<number>(
      "select count(*)::int as v from public.admin_audit_logs where action='credits'",
    ),
    1,
  );
  await db.query(
    "select public.admin_mutate($1,'entitlement',$2,$3,'test override')",
    [founder, user, { key: "persona_limit", value: 100 }],
  );
  const p = await value<Record<string, unknown>>(
    "select public.resolve_product_policy($1,false) as v",
    [user],
  );
  assert.equal(p.persona_limit, 100);
  await db.query(
    "update public.user_entitlements set expires_at=now()-interval '1 second' where user_id=$1",
    [user],
  );
  const expired = await value<Record<string, unknown>>(
    "select public.resolve_product_policy($1,false) as v",
    [user],
  );
  assert.equal(expired.persona_limit, 1);
});
test("authenticated users cannot write roles/settings or invoke privileged service functions", async () => {
  await db.exec("set local role authenticated");
  await rejects(
    () =>
      db.query("insert into public.user_roles values($1,'super_admin')", [
        user,
      ]),
    /permission denied/,
  );
  await rejects(
    () => db.query("select public.resolve_product_policy($1,false)", [user]),
    /permission denied/,
  );
  await rejects(
    () => db.query("select public.bootstrap_platform_owner($1)", [user]),
    /permission denied/,
  );
  await rejects(
    () => db.query("update public.platform_settings set value='100'"),
    /permission denied/,
  );
});
test("credit reservations refund unused balance and finalize usage exactly once", async () => {
  await db.query(
    "update public.subscriptions set plan='creator' where user_id=$1",
    [user],
  );
  await db.query(
    "insert into public.usage_events(user_id,event_type,quantity) values($1,'stream_minutes',600)",
    [user],
  );
  await db.query(
    "insert into public.credit_accounts(user_id,balance) values($1,10) on conflict(user_id) do update set balance=10",
    [user],
  );
  await db.query(
    "select public.admin_mutate($1,'entitlement',$2,$3,'bypass trial for credit test')",
    [founder, user, { key: "bypass_trial_limit", value: true }],
  );
  const s = await reserve();
  assert.equal(s.metadata.max_duration_seconds, 600);
  assert.equal(
    await value<number>(
      "select balance::int as v from public.credit_accounts where user_id=$1",
      [user],
    ),
    0,
  );
  await db.query(
    "update public.live_sessions set started_at=now()-interval '60 seconds' where id=$1",
    [s.id],
  );
  await db.query("select public.finish_session($1)", [s.id]);
  await db.query("select public.finish_session($1)", [s.id]);
  assert.equal(
    await value<number>(
      "select balance::int as v from public.credit_accounts where user_id=$1",
      [user],
    ),
    9,
  );
});
test("stale sessions expire and the last founder cannot be demoted", async () => {
  const s = await reserve();
  await db.query(
    "update public.live_sessions set heartbeat_at=now()-interval '3 minutes' where id=$1",
    [s.id],
  );
  const expired = await db.query("select * from public.reap_stale_sessions()");
  assert.equal(expired.rows.length, 1);
  assert.equal(
    await value<string>(
      "select status as v from public.live_sessions where id=$1",
      [s.id],
    ),
    "stopped",
  );
  await rejects(
    () =>
      db.query(
        "select public.admin_mutate($1,'role',$2,'{\"role\":\"user\"}','role test')",
        [founder, founder],
      ),
    /last super/,
  );
});
test("admin inputs reject invalid limits, forged readiness and malformed credit changes", () => {
  assert.throws(() =>
    validateChanges("setting", "trial.duration_seconds", { value: -1 }),
  );
  assert.throws(() =>
    validateChanges("entitlement", user, { key: "role", value: "super_admin" }),
  );
  assert.throws(() =>
    validateChanges("credits", user, { mode: "set", amount: -1 }),
  );
  assert.throws(() =>
    validateChanges("demo", atlas, { inference_ready: true }),
  );
});
