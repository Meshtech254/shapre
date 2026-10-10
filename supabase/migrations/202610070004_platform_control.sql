-- Run after 001, 002 and 003. All privileged writes go through audited service RPCs.
create table public.user_roles(user_id uuid primary key references auth.users on delete cascade, role text not null default 'user' check(role in ('user','admin','super_admin')));
create table public.platform_settings(key text primary key, value jsonb not null, description text not null default '', updated_by uuid references auth.users, updated_at timestamptz not null default now());
create table public.user_entitlements(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, entitlement_key text not null, value jsonb not null, starts_at timestamptz, expires_at timestamptz, reason text, created_by uuid references auth.users, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,entitlement_key), check(expires_at is null or starts_at is null or expires_at>starts_at));
create table public.credit_accounts(user_id uuid primary key references auth.users on delete cascade, balance numeric not null default 0 check(balance>=0), trial_uses int not null default 0 check(trial_uses>=0));
create table public.admin_audit_logs(id uuid primary key default gen_random_uuid(), admin_user_id uuid references auth.users, action text not null, target_type text not null, target_id text, previous_value jsonb, new_value jsonb, reason text not null, created_at timestamptz not null default now());
create index entitlement_owner on public.user_entitlements(user_id,expires_at);
create index audit_recent on public.admin_audit_logs(created_at desc);
alter table public.user_roles enable row level security;
alter table public.platform_settings enable row level security;
alter table public.user_entitlements enable row level security;
alter table public.credit_accounts enable row level security;
alter table public.admin_audit_logs enable row level security;
revoke all on public.user_roles,public.platform_settings,public.user_entitlements,public.credit_accounts,public.admin_audit_logs from anon,authenticated;
insert into public.credit_accounts(user_id,trial_uses) select p.id,case when t.user_id is null then 0 else 1 end from public.profiles p left join public.demo_trials t on t.user_id=p.id;
create function public.setting(setting_key text, fallback jsonb) returns jsonb language sql stable security definer set search_path='' as $$ select coalesce((select value from public.platform_settings where key=setting_key),fallback) $$;
revoke execute on function public.setting(text,jsonb) from public,anon,authenticated;
grant execute on function public.setting(text,jsonb) to service_role;

create function public.resolve_product_policy(owner_id uuid,test_normal boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text; p text; result jsonb; overrides jsonb; used numeric; bal numeric; testing boolean;
begin
 select coalesce((select role from public.user_roles where user_id=owner_id),'user') into r;
 testing := test_normal and r in ('admin','super_admin');
 select coalesce((select plan from public.subscriptions where user_id=owner_id and status='active'),'free') into p;
 select coalesce(sum(quantity),0) into used from public.usage_events where user_id=owner_id and event_type='stream_minutes' and created_at>=date_trunc('month',now());
 select coalesce((select balance from public.credit_accounts where user_id=owner_id),0) into bal;
 result := jsonb_build_object('role',r,'testing',testing,'plan',p,'balance',bal,'used_minutes',used,
 'monthly_minutes',coalesce((public.setting('plans.monthly_minutes','{"free":30,"creator":600,"pro":2400}') ->> p)::numeric,30),
 'persona_limit',public.setting('personas.'||p||'_limit',to_jsonb(case p when 'pro' then 20 when 'creator' then 5 else 1 end)),
 'trial_seconds',public.setting('trial.duration_seconds','60'),'trial_enabled',public.setting('trial.enabled','true'),
 'max_concurrent_sessions',public.setting('stream.max_concurrent_sessions','1'),
 'unlimited_credits',false,'unlimited_streaming',false,'unlimited_personas',false,'bypass_trial_limit',false,
 'bypass_product_limits',false,'access_all_quality_modes',p='pro','access_preview_features',false);
 if not testing and r='super_admin' then
 result := result || '{"unlimited_credits":true,"unlimited_streaming":true,"unlimited_personas":true,"bypass_trial_limit":true,"bypass_product_limits":true,"access_all_quality_modes":true,"access_preview_features":true}';
 end if;
 if not testing then
 select coalesce(jsonb_object_agg(entitlement_key,value),'{}') into overrides from public.user_entitlements where user_id=owner_id and (starts_at is null or starts_at<=now()) and (expires_at is null or expires_at>now());
 result := result || overrides;
 end if;
 return result;
end $$;
revoke execute on function public.resolve_product_policy(uuid,boolean) from public,anon,authenticated;
grant execute on function public.resolve_product_policy(uuid,boolean) to service_role;

-- Callers cannot choose their security rate limit. This fixes migration 001's missing analytics action.
create or replace function public.consume_rate_limit(action_name text,max_requests int,window_seconds int) returns boolean language plpgsql security definer set search_path='' as $$
declare n int; cap int;
begin
 if auth.uid() is null then return false; end if;
 cap := case action_name when 'persona' then 5 when 'upload' then 30 when 'process' then 10 when 'session' then 5 when 'delete' then 10 when 'admin' then 30 when 'demo-analytics' then least(60,greatest(1,(public.setting('analytics.demo_rate_limit','30')#>>'{}')::int)) else 0 end;
 if cap=0 then return false; end if;
 insert into public.rate_limits as r(user_id,action,window_start,requests) values(auth.uid(),action_name,now(),1)
 on conflict(user_id,action) do update set requests=case when r.window_start<now()-interval '60 seconds' then 1 else r.requests+1 end, window_start=case when r.window_start<now()-interval '60 seconds' then now() else r.window_start end returning requests into n;
 return n<=cap;
end $$;

-- Multiple sessions are possible only through the account-locked reservation procedure.
drop index public.one_active_session;
create index active_sessions_owner on public.live_sessions(user_id) where status in ('initializing','connected','live');
alter table public.live_sessions add column heartbeat_at timestamptz not null default now();
create index session_heartbeat on public.live_sessions(heartbeat_at) where status in ('initializing','connected','live');
create function public.reserve_studio_session(owner_id uuid,persona uuid,demo uuid,session_metadata jsonb,test_normal boolean default false) returns public.live_sessions language plpgsql security definer set search_path='' as $$
declare policy jsonb; d public.demo_personas; s public.live_sessions; is_trial boolean; seconds int; remaining numeric; reserved numeric; mult numeric; allowance numeric; credits numeric:=0; normal boolean; q text;
begin
 perform 1 from public.profiles where id=owner_id for update;
 if not found then raise exception 'Account not found'; end if;
 insert into public.credit_accounts(user_id) values(owner_id) on conflict do nothing;
 policy:=public.resolve_product_policy(owner_id,test_normal);
 normal:=not (policy->>'bypass_product_limits')::boolean;
 if (select count(*) from public.live_sessions where user_id=owner_id and status in ('initializing','connected','live')) >= (policy->>'max_concurrent_sessions')::int then raise exception 'Concurrent session limit reached'; end if;
 q:=session_metadata->'settings'->>'quality';
 if q not in ('Low Latency','Balanced','High Quality') then raise exception 'Invalid quality'; end if;
 if q='High Quality' and not (policy->>'access_all_quality_modes')::boolean then raise exception 'High Quality requires an entitlement'; end if;
 is_trial:=demo is not null and not (policy->>'bypass_trial_limit')::boolean and normal;
 if demo is not null then
 select * into d from public.demo_personas where id=demo for share;
 if not found or not d.active or d.metadata->>'placeholder'='true' then raise exception 'Demo is unavailable'; end if;
 if not (public.setting('demo.enabled','true')#>>'{}')::boolean and normal then raise exception 'Demos are disabled'; end if;
 if session_metadata->>'mock'='true' then
  if d.face_source_reference is null and not d.face_ready then raise exception 'Demo face asset is missing'; end if;
 elsif not d.inference_ready or not d.face_ready or d.face_asset_reference is null then raise exception 'Demo face model must be prepared by your worker'; end if;
 elsif persona is null or not exists(select 1 from public.personas where id=persona and user_id=owner_id and face_status='ready' and moderation_status<>'blocked') then raise exception 'Persona is not ready'; end if;
 mult:=coalesce((public.setting('stream.quality_multipliers','{"Low Latency":1,"Balanced":1,"High Quality":1}')->>q)::numeric,1);
 if is_trial then
 if not (policy->>'trial_enabled')::boolean then raise exception 'Trials are disabled'; end if;
 if (public.setting('trial.require_verification','false')#>>'{}')::boolean and not exists(select 1 from auth.users where id=owner_id and email_confirmed_at is not null) then raise exception 'Verify your email before starting a trial'; end if;
 if (select trial_uses from public.credit_accounts where user_id=owner_id)>=(public.setting('trial.max_sessions','1')#>>'{}')::int then raise exception 'Demo trial already used'; end if;
 if q <> (public.setting('trial.quality','"Balanced"')#>>'{}') and not (policy->>'access_all_quality_modes')::boolean then raise exception 'Select the configured trial quality'; end if;
 seconds:=(policy->>'trial_seconds')::int;
 update public.credit_accounts set trial_uses=trial_uses+1 where user_id=owner_id;
 else
 seconds:=case when (policy->>'unlimited_streaming')::boolean or not normal then 86400 else least(86400,(public.setting('stream.max_session_minutes','120')#>>'{}')::numeric*60)::int end;
 if demo is not null and normal then seconds:=least(seconds,(public.setting('demo.max_session_seconds','3600')#>>'{}')::int); end if;
 if not (policy->>'unlimited_credits')::boolean and normal then
 select coalesce(sum((metadata->>'reserved_minutes')::numeric),0) into reserved from public.live_sessions where user_id=owner_id and status in ('initializing','connected','live') and created_at>=date_trunc('month',now());
 allowance:=greatest(0,(policy->>'monthly_minutes')::numeric-(policy->>'used_minutes')::numeric-reserved);
 remaining:=allowance+(select balance from public.credit_accounts where user_id=owner_id);
 if remaining < greatest(0.01,(public.setting('stream.minimum_balance','0.01')#>>'{}')::numeric) then raise exception 'Streaming balance exhausted'; end if;
 seconds:=least(seconds,floor(remaining*60/mult)::int);
 credits:=greatest(0,seconds/60.0*mult-allowance);
 update public.credit_accounts set balance=balance-credits where user_id=owner_id;
 end if;
 end if;
 if seconds<1 then raise exception 'Streaming balance exhausted'; end if;
 insert into public.live_sessions(user_id,persona_id,demo_persona_id,metadata) values(owner_id,persona,demo,session_metadata || jsonb_build_object('trial',is_trial,'watermark',is_trial or (policy->>'plan'='free' and normal),'expires_at',now()+make_interval(secs=>seconds),'max_duration_seconds',seconds,'quality_multiplier',mult,'reserved_minutes',case when credits>0 then seconds/60.0*mult-credits when normal and not is_trial and not (policy->>'unlimited_credits')::boolean then seconds/60.0*mult else 0 end,'reserved_credits',credits,'unmetered',not normal or (policy->>'unlimited_credits')::boolean)) returning * into s;
 if is_trial then insert into public.demo_trials(user_id,session_id,started_at,completed_at) values(owner_id,s.id,now(),null) on conflict(user_id) do update set session_id=s.id,started_at=now(),completed_at=null; end if;
 return s;
end $$;
revoke execute on function public.reserve_studio_session(uuid,uuid,uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.reserve_studio_session(uuid,uuid,uuid,jsonb,boolean) to service_role;
-- Retire the older hardcoded trial entry point.
revoke execute on function public.begin_demo_trial(uuid,uuid,jsonb) from service_role;

create or replace function public.finish_session(session_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare s public.live_sessions; seconds int; cost numeric; credit_use numeric;
begin
 -- Account first, session second: the same lock order as reservations and admin operations.
 perform 1 from public.profiles where id=(select user_id from public.live_sessions where id=session_id) for update;
 select * into s from public.live_sessions where id=session_id for update;
 if not found or s.status in ('stopped','failed') then return; end if;
 seconds:=greatest(0,least(extract(epoch from(now()-coalesce(s.started_at,now())))::int,coalesce((s.metadata->>'max_duration_seconds')::int,86400)));
 cost:=seconds/60.0*coalesce((s.metadata->>'quality_multiplier')::numeric,1);
 credit_use:=least(coalesce((s.metadata->>'reserved_credits')::numeric,0),greatest(0,cost-coalesce((s.metadata->>'reserved_minutes')::numeric,0)));
 update public.credit_accounts set balance=balance+greatest(0,coalesce((s.metadata->>'reserved_credits')::numeric,0)-credit_use) where user_id=s.user_id;
 update public.live_sessions set status='stopped',ended_at=now(),duration_seconds=seconds,metadata=metadata||jsonb_build_object('credits_used',credit_use) where id=s.id;
 if s.metadata->>'trial'='true' then
 if s.started_at is null then
 update public.credit_accounts set trial_uses=greatest(0,trial_uses-1) where user_id=s.user_id;
 delete from public.demo_trials t where t.user_id=s.user_id and t.session_id=s.id;
 else
 update public.demo_trials t set completed_at=now() where t.user_id=s.user_id and t.session_id=s.id;
 insert into public.demo_analytics(user_id,demo_persona_id,event,session_id) values(s.user_id,s.demo_persona_id,'demo_trial_completed',s.id) on conflict do nothing;
 end if;
 elsif s.started_at is not null and coalesce(s.metadata->>'unmetered','false')<>'true' then
 insert into public.usage_events(user_id,live_session_id,event_type,quantity,metadata) values(s.user_id,s.id,'stream_minutes',greatest(0,cost-credit_use),jsonb_build_object('credits_used',credit_use,'raw_minutes',seconds/60.0)) on conflict do nothing;
 end if;
end $$;

create function public.create_platform_persona(owner_id uuid,persona_name text,persona_description text,voice_consent boolean,test_normal boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare policy jsonb; result uuid;
begin
 perform 1 from public.profiles where id=owner_id for update;
 if not found then raise exception 'Account not found'; end if;
 policy:=public.resolve_product_policy(owner_id,test_normal);
 if not (policy->>'unlimited_personas')::boolean and not (policy->>'bypass_product_limits')::boolean and (select count(*) from public.personas where user_id=owner_id)>=(policy->>'persona_limit')::int then raise exception 'Persona limit reached'; end if;
 insert into public.personas(user_id,name,description,consent_face_confirmed_at,consent_voice_confirmed_at) values(owner_id,persona_name,persona_description,now(),case when voice_consent then now() else null end) returning id into result;
 return result;
end $$;
revoke execute on function public.create_platform_persona(uuid,text,text,boolean,boolean) from public,anon,authenticated;
grant execute on function public.create_platform_persona(uuid,text,text,boolean,boolean) to service_role;
revoke execute on function public.create_persona(text,text,boolean) from authenticated;
create or replace function public.limit_face_assets() returns trigger language plpgsql set search_path='' as $$ begin perform 1 from public.personas where id=new.persona_id for update; if (select count(*) from public.persona_face_assets where persona_id=new.persona_id)>=(public.setting('personas.max_face_images','10')#>>'{}')::int then raise exception 'Face image limit reached'; end if; return new; end $$;

create function public.admin_mutate(actor uuid,operation text,target text,changes jsonb,note text) returns jsonb language plpgsql security definer set search_path='' as $$
declare r text; previous jsonb; result jsonb; target_user uuid; d public.demo_personas;
begin
 -- Serialize admin changes including role changes; never accept client-supplied actor roles.
 perform pg_advisory_xact_lock(771042);
 select role into r from public.user_roles where user_id=actor;
 if r is null or r not in ('admin','super_admin') then raise exception 'Administrator access required'; end if;
 if char_length(trim(note))<3 then raise exception 'A reason is required'; end if;
 if operation<>'demo' and r<>'super_admin' then raise exception 'Super administrator required'; end if;
 if operation='setting' then
 select to_jsonb(s) into previous from public.platform_settings s where key=target;
 if previous is null then raise exception 'Unknown setting'; end if;
 update public.platform_settings set value=changes->'value',updated_by=actor,updated_at=now() where key=target returning to_jsonb(platform_settings.*) into result;
 elsif operation in ('credits','trial_reset','entitlement','role') then
 target_user:=target::uuid;
 perform 1 from public.profiles where id=target_user for update;
 if not found then raise exception 'User not found'; end if;
 if operation='role' then
 select to_jsonb(u) into previous from public.user_roles u where user_id=target_user;
 if changes->>'role' not in ('user','admin','super_admin') then raise exception 'Invalid role'; end if;
 if previous->>'role'='super_admin' and changes->>'role'<>'super_admin' and (select count(*) from public.user_roles where role='super_admin')<=1 then raise exception 'Cannot remove the last super administrator'; end if;
 insert into public.user_roles(user_id,role) values(target_user,changes->>'role') on conflict(user_id) do update set role=excluded.role returning to_jsonb(user_roles.*) into result;
 elsif operation='entitlement' then
 select to_jsonb(e) into previous from public.user_entitlements e where user_id=target_user and entitlement_key=changes->>'key';
 insert into public.user_entitlements(user_id,entitlement_key,value,starts_at,expires_at,reason,created_by) values(target_user,changes->>'key',changes->'value',(changes->>'starts_at')::timestamptz,(changes->>'expires_at')::timestamptz,note,actor) on conflict(user_id,entitlement_key) do update set value=excluded.value,starts_at=excluded.starts_at,expires_at=excluded.expires_at,reason=note,updated_at=now() returning to_jsonb(user_entitlements.*) into result;
 else
 insert into public.credit_accounts(user_id) values(target_user) on conflict do nothing;
 select to_jsonb(c) into previous from public.credit_accounts c where user_id=target_user;
 if operation='credits' then
 update public.credit_accounts set balance=case when changes->>'mode'='set' then (changes->>'amount')::numeric else balance+(changes->>'amount')::numeric end where user_id=target_user returning to_jsonb(credit_accounts.*) into result;
 else
 if exists(select 1 from public.live_sessions where user_id=target_user and status in ('initializing','connected','live')) then raise exception 'Stop active sessions before resetting a trial'; end if;
 update public.credit_accounts set trial_uses=0 where user_id=target_user returning to_jsonb(credit_accounts.*) into result;
 delete from public.demo_trials where user_id=target_user;
 end if;
 end if;
 elsif operation='demo' then
 select to_jsonb(p) into previous from public.demo_personas p where id=target::uuid;
 if previous is null then
 d:=jsonb_populate_record(null::public.demo_personas,changes||jsonb_build_object('id',target::uuid,'created_at',now(),'updated_at',now()));
 insert into public.demo_personas select d.* returning to_jsonb(demo_personas.*) into result;
 else
 d:=jsonb_populate_record(null::public.demo_personas,previous||changes);
 update public.demo_personas set name=d.name,slug=d.slug,description=d.description,category=d.category,style=d.style,thumbnail_url=d.thumbnail_url,preview_image_url=d.preview_image_url,studio_avatar_url=d.studio_avatar_url,face_source_reference=d.face_source_reference,face_asset_reference=d.face_asset_reference,voice_asset_reference=d.voice_asset_reference,active=d.active,featured=d.featured,sort_order=d.sort_order,inference_ready=d.inference_ready,face_ready=d.face_ready,voice_ready=d.voice_ready,metadata=d.metadata,tags=d.tags,gender_presentation=d.gender_presentation where id=target::uuid returning to_jsonb(demo_personas.*) into result;
 end if;
 elsif operation='stop_session' then
 select to_jsonb(s) into previous from public.live_sessions s where id=target::uuid;
 if previous is null then raise exception 'Session not found'; end if;
 perform public.finish_session(target::uuid);
 select to_jsonb(s) into result from public.live_sessions s where id=target::uuid;
 else raise exception 'Unsupported admin operation'; end if;
 insert into public.admin_audit_logs(admin_user_id,action,target_type,target_id,previous_value,new_value,reason) values(actor,operation,operation,target,previous,result,note);
 return result;
end $$;
revoke execute on function public.admin_mutate(uuid,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.admin_mutate(uuid,text,text,jsonb,text) to service_role;

-- Service-owned public image bucket; browser uploads require an admin-issued signed token.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('demo-avatars','demo-avatars',true,10485760,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create function public.bootstrap_platform_owner(owner_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(771042);
 if exists(select 1 from public.user_roles where user_id=owner_id and role='super_admin') then return; end if;
 if exists(select 1 from public.user_roles where role='super_admin') then raise exception 'Founder already configured. Use the audited admin role control.'; end if;
 if not exists(select 1 from public.profiles where id=owner_id) then raise exception 'Sign up before assigning the founder role'; end if;
 insert into public.user_roles(user_id,role) values(owner_id,'super_admin') on conflict(user_id) do update set role='super_admin';
 insert into public.admin_audit_logs(admin_user_id,action,target_type,target_id,new_value,reason) values(owner_id,'bootstrap_owner','role',owner_id::text,'{"role":"super_admin"}','Initial founder bootstrap using service credentials');
end $$;
revoke execute on function public.bootstrap_platform_owner(uuid) from public,anon,authenticated;
grant execute on function public.bootstrap_platform_owner(uuid) to service_role;
create function public.reap_stale_sessions() returns table(session_id uuid,inference_session_id text) language plpgsql security definer set search_path='' as $$
declare s public.live_sessions;
begin
 for s in select * from public.live_sessions l where l.status in ('initializing','connected','live') and (l.heartbeat_at<now()-interval '120 seconds' or (l.metadata->>'expires_at')::timestamptz<=now()) loop
 perform public.finish_session(s.id);session_id:=s.id;inference_session_id:=s.inference_session_id;return next;
 end loop;
end $$;
revoke execute on function public.reap_stale_sessions() from public,anon,authenticated;
grant execute on function public.reap_stale_sessions() to service_role;
-- If pg_cron is already provisioned, stale DB sessions expire even without the web process.
do $$ begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
 execute $cron$select cron.schedule('shapre-stale-sessions','* * * * *','select public.reap_stale_sessions()')$cron$;
 end if;
end $$;

-- Generated platform defaults
insert into public.platform_settings(key,value,description) values('trial.enabled','true'::jsonb,'trial.enabled') on conflict(key) do nothing;
insert into public.platform_settings(key,value,description) values('trial.duration_seconds','60'::jsonb,'trial.duration_seconds') on conflict(key) do nothing;
insert into public.platform_settings(key,value,description) values('trial.require_verification','false'::jsonb,'trial.require_verification') on conflict(key) do nothing;
insert into public.platform_settings(key,value,description) values('trial.max_sessions','1'::jsonb,'trial.max_sessions') on conflict(key) do nothing;
insert into public.platform_settings(key,value,description) values('trial.quality','"Balanced"'::jsonb,'trial.quality') on conflict(key) do nothing;
insert into public.platform_settings(key,value,description) values('personas.free_limit','1'::jsonb,'personas.free_limit') on conflict(key) do nothing;
insert into public.platform_settings(key,value,description) values('personas.creator_limit','5'::jsonb,'personas.creator_limit') on conflict(key) do nothing;
insert into public.platform_settings(key,value,description) values('personas.pro_limit','20'::jsonb,'personas.pro_limit') on conflict(key) do nothing;
insert into public.platform_settings(key,value,description) values('personas.max_face_images','10'::jsonb,'personas.max_face_images') on conflict(key) do nothing;
insert into public.platform_settings(key,value,description) values('personas.image_size_mb','10'::jsonb,'personas.image_size_mb') on conflict(key) do nothing;
insert into public.platform_settings(key,value,description) values('personas.voice_duration_seconds','300'::jsonb,'personas.voice_duration_seconds') on conflict(key) do nothing;
insert into public.platform_settings(key,value,description) values('personas.voice_size_mb','50'::jsonb,'personas.voice_size_mb') on conflict(key) do nothing;
insert into public.platform_settings(key,value,description) values('stream.max_session_minutes','120'::jsonb,'stream.max_session_minutes') on conflict(key) do nothing;
insert into public.platform_settings(key,value,description) values('stream.minimum_balance','0.01'::jsonb,'stream.minimum_balance') on conflict(key) do nothing;
insert into public.platform_settings(key,value,description) values('stream.max_concurrent_sessions','1'::jsonb,'stream.max_concurrent_sessions') on conflict(key) do nothing;
insert into public.platform_settings(key,value,description) values('stream.resolutions','["1280x720"]'::jsonb,'stream.resolutions') on conflict(key) do nothing;
insert into public.platform_settings(key,value,description) values('stream.fps','[30]'::jsonb,'stream.fps') on conflict(key) do nothing;
insert into public.platform_settings(key,value,description) values('stream.quality_multipliers','{"Low Latency":1,"Balanced":1,"High Quality":1}'::jsonb,'stream.quality_multipliers') on conflict(key) do nothing;
insert into public.platform_settings(key,value,description) values('demo.enabled','true'::jsonb,'demo.enabled') on conflict(key) do nothing;
insert into public.platform_settings(key,value,description) values('demo.max_session_seconds','3600'::jsonb,'demo.max_session_seconds') on conflict(key) do nothing;
insert into public.platform_settings(key,value,description) values('demo.featured_count','6'::jsonb,'demo.featured_count') on conflict(key) do nothing;
insert into public.platform_settings(key,value,description) values('analytics.demo_rate_limit','30'::jsonb,'analytics.demo_rate_limit') on conflict(key) do nothing;
insert into public.platform_settings(key,value,description) values('analytics.event_quota','500'::jsonb,'analytics.event_quota') on conflict(key) do nothing;
insert into public.platform_settings(key,value,description) values('pricing.plans','{"free":0,"creator":29,"pro":99,"currency":"USD"}'::jsonb,'pricing.plans') on conflict(key) do nothing;
insert into public.platform_settings(key,value,description) values('plans.monthly_minutes','{"free":30,"creator":600,"pro":2400}'::jsonb,'plans.monthly_minutes') on conflict(key) do nothing;
