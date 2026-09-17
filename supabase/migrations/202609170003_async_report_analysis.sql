-- Reporter submissions are stored immediately, then enriched by AI asynchronously.
do $$
declare
  existing_constraint text;
begin
  select conname into existing_constraint
  from pg_constraint
  where conrelid = 'public.issues'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%status%';

  if existing_constraint is not null then
    execute format('alter table public.issues drop constraint %I', existing_constraint);
  end if;

  alter table public.issues add constraint issues_status_check
    check (status in ('ANALYZING', 'ANALYSIS_FAILED', 'OPEN', 'IN_PROGRESS', 'VERIFYING', 'RESOLVED', 'NO_ISSUE'));
end $$;
