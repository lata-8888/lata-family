-- Einmaliges Upgrade für Projekte, deren Tasks noch eine einzelne Person haben (lata-tasks.assigned_to, Termin Pflicht).
-- Neue Projekte brauchen das nicht: supabase/schema_lata.sql genügt. Reihenfolge: zuerst diese Datei, dann schema_lata.sql.
-- Enthält «drop»-Befehle: im Supabase SQL-Editor ausführen.

create table if not exists public."lata-task_assignees" (
  task_id uuid not null references public."lata-tasks"(id) on delete cascade,
  user_id uuid not null references public."lata-profiles"(id) on delete cascade,
  primary key (task_id, user_id)
);
do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'lata-tasks' and column_name = 'assigned_to') then
    execute 'insert into public."lata-task_assignees" (task_id, user_id) select id, assigned_to from public."lata-tasks" where assigned_to is not null on conflict do nothing';
  end if;
end $$;
alter table public."lata-tasks" alter column due_date drop not null;
-- Erst nach erfolgreicher Übernahme und nachdem die neue App-Version läuft:
-- alter table public."lata-tasks" drop column assigned_to;
