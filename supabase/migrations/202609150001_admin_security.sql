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
