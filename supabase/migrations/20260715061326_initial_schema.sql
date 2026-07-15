-- SecureVibe initial schema (applied to project pftlfrecrvnptdmjoaxq)
-- Design rule: no table can hold raw source code. Findings store only a
-- file path, line number, and a single MASKED evidence line.

-- ============ profiles ============
-- One row per user, created automatically when someone signs up.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  plan text not null default 'free' check (plan in ('free', 'pro')),
  stripe_customer_id text unique,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users can see their own profile. Nobody can write it from the browser:
-- plan changes happen only through the Stripe webhook (server, service key).
create policy "read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user is created.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ subscriptions ============
-- Mirror of Stripe subscription state. Written ONLY by the Stripe webhook.
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stripe_subscription_id text not null unique,
  status text not null,
  price_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

create index subscriptions_user_id_idx on public.subscriptions (user_id);

alter table public.subscriptions enable row level security;

create policy "read own subscription"
  on public.subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

-- ============ scans ============
create table public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_type text not null check (source_type in ('github', 'zip')),
  -- Display-only reference: the repo URL or the original zip filename.
  source_ref text not null,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  error_message text,
  -- Aggregate numbers only (files scanned, bytes, duration, counts).
  stats jsonb,
  -- Trust stamp: when the raw source code was destroyed.
  source_deleted_at timestamptz,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index scans_user_created_idx on public.scans (user_id, created_at desc);

alter table public.scans enable row level security;

create policy "read own scans"
  on public.scans for select
  to authenticated
  using (auth.uid() = user_id);

create policy "create own scans"
  on public.scans for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "update own scans"
  on public.scans for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============ findings ============
create table public.findings (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  check_type text not null
    check (check_type in ('secret', 'platform_config', 'dependency', 'insecure_pattern')),
  severity text not null check (severity in ('critical', 'high', 'medium', 'low')),
  title text not null,
  explanation text not null,
  file_path text,
  line_start integer,
  -- One line max, secrets always masked before it gets here.
  evidence_masked text,
  recommendation text not null,
  created_at timestamptz not null default now()
);

create index findings_scan_id_idx on public.findings (scan_id);

alter table public.findings enable row level security;

create policy "read findings of own scans"
  on public.findings for select
  to authenticated
  using (exists (
    select 1 from public.scans
    where scans.id = findings.scan_id and scans.user_id = auth.uid()
  ));

create policy "insert findings into own scans"
  on public.findings for insert
  to authenticated
  with check (exists (
    select 1 from public.scans
    where scans.id = findings.scan_id and scans.user_id = auth.uid()
  ));

-- ============ package_checks ============
-- Cache of public npm/PyPI registry lookups so we do not hammer their APIs.
-- Readable by any signed-in user (it is public data); written only by the
-- server with the service key so users cannot poison other users' results.
create table public.package_checks (
  registry text not null check (registry in ('npm', 'pypi')),
  name text not null,
  exists_on_registry boolean not null,
  published_at timestamptz,
  weekly_downloads bigint,
  fetched_at timestamptz not null default now(),
  primary key (registry, name)
);

alter table public.package_checks enable row level security;

create policy "read package cache"
  on public.package_checks for select
  to authenticated
  using (true);

-- ============ storage: transient zip uploads ============
-- Private bucket. Objects live only for the duration of a scan; the scan
-- pipeline deletes them immediately, and a daily cron sweeps any orphans.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'uploads', 'uploads', false, 52428800,
  array['application/zip', 'application/x-zip-compressed', 'application/octet-stream']
);

-- Each user may only touch objects inside their own folder: {user_id}/...
create policy "upload own zips"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "read own zips"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "delete own zips"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'uploads' and (storage.foldername(name))[1] = auth.uid()::text);
