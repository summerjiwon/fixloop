-- 공간기록 Day 2 schema. Run in the Supabase SQL editor before setting DATA_BACKEND=supabase.
create extension if not exists vector;

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  name text not null,
  category text,
  zone text,
  created_at timestamptz not null default now()
);

create table if not exists public.report_drafts (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  before_image_path text not null,
  reporter_text text,
  analysis jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.issues (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id),
  area text not null default '미분류 공간',
  asset_id uuid references public.assets(id),
  title text not null,
  description text not null,
  category text not null,
  asset_name text not null,
  severity text not null check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status text not null default 'OPEN' check (status in ('ANALYZING', 'ANALYSIS_FAILED', 'OPEN', 'IN_PROGRESS', 'VERIFYING', 'RESOLVED', 'NO_ISSUE')),
  ai_confidence real not null check (ai_confidence between 0 and 1),
  operator_comment text not null default '관리자 확인 필요',
  embedding vector(1536),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Safe to rerun when upgrading an existing Day 2 database.
alter table public.issues add column if not exists area text not null default '미분류 공간';
alter table public.issues add column if not exists operator_comment text not null default '관리자 확인 필요';

create table if not exists public.issue_images (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references public.issues(id) on delete cascade,
  image_path text not null,
  type text not null check (type in ('BEFORE', 'AFTER')),
  created_at timestamptz not null default now()
);

create table if not exists public.issue_matches (
  issue_id uuid not null references public.issues(id) on delete cascade,
  candidate_issue_id uuid not null references public.issues(id) on delete cascade,
  similarity real not null check (similarity between 0 and 1),
  created_at timestamptz not null default now(),
  primary key (issue_id, candidate_issue_id)
);

create table if not exists public.issue_verifications (
  issue_id uuid primary key references public.issues(id) on delete cascade,
  same_asset boolean not null,
  visible_issue_resolved boolean not null,
  confidence real not null check (confidence between 0 and 1),
  reason text not null,
  limitations jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists issues_location_created_idx on public.issues(location_id, created_at desc);
create index if not exists issues_status_idx on public.issues(status);
create index if not exists issue_images_issue_idx on public.issue_images(issue_id);

-- Call after generating a 1536-dimension embedding for normalized issue text.
-- Same-location rows are ranked first; the application only presents candidates and never auto-merges them.
create or replace function public.match_similar_issues(
  query_embedding vector(1536),
  query_location_id uuid,
  match_threshold real default 0.72,
  match_count int default 5
)
returns table (issue_id uuid, similarity real)
language sql stable
as $$
  select i.id, (1 - (i.embedding <=> query_embedding))::real as similarity
  from public.issues i
  where i.embedding is not null
    and i.location_id = query_location_id
    and (1 - (i.embedding <=> query_embedding)) >= match_threshold
  order by i.embedding <=> query_embedding
  limit match_count;
$$;

-- Keep the bucket private. The backend returns signed URLs; never expose the service role key to Next.js.
insert into storage.buckets (id, name, public)
values ('issue-images', 'issue-images', false)
on conflict (id) do nothing;

-- Seed one location for the first reporter-flow test.
insert into public.locations (id, name, address)
values ('00000000-0000-0000-0000-000000000001', 'Demo location', 'Replace before production')
on conflict (id) do nothing;
