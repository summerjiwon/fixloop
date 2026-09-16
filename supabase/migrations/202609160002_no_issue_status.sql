-- Apply after the existing schema and admin-security migration.
-- NO_ISSUE is a terminal decision for a report confirmed not to be a real facility problem.
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
    check (status in ('OPEN', 'IN_PROGRESS', 'VERIFYING', 'RESOLVED', 'NO_ISSUE'));
end $$;
