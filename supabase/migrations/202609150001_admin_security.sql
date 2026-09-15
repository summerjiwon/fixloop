-- Apply after schema.sql. The FastAPI service uses the server key; browsers have no direct table access.
alter table public.locations enable row level security;
alter table public.assets enable row level security;
alter table public.report_drafts enable row level security;
alter table public.issues enable row level security;
alter table public.issue_images enable row level security;
alter table public.issue_matches enable row level security;
alter table public.issue_verifications enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- The issue-images bucket remains private. No storage.objects policy is added for anon/authenticated;
-- uploads and signed URLs are created only by the server-side service key.

create or replace function public.set_issue_embedding(p_issue_id uuid, p_embedding text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.issues set embedding = p_embedding::vector where id = p_issue_id;
$$;

create or replace function public.find_similar_issues_for_issue(
  p_issue_id uuid,
  p_threshold real default 0.72,
  p_count int default 5
)
returns table (issue_id uuid, similarity real)
language sql stable security definer
set search_path = public
as $$
  select candidate.id, (1 - (candidate.embedding <=> target.embedding))::real
  from public.issues target
  join public.issues candidate on candidate.location_id = target.location_id and candidate.id <> target.id
  where target.id = p_issue_id
    and target.embedding is not null
    and candidate.embedding is not null
    and (1 - (candidate.embedding <=> target.embedding)) >= p_threshold
  order by candidate.embedding <=> target.embedding
  limit p_count;
$$;
