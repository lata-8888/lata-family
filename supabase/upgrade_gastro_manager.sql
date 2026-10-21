-- Rolle «Gastro Manager»: schaltet Gastronomien ein/aus und eröffnet Gäste. Gäste sehen nur Gastro und Profil (Events/Tasks nur für Mitglieder).
alter table public."lata-profiles" add column if not exists is_gastro_manager boolean not null default false;
-- Funktionen lata_can_manage_gastro, lata_is_member, lata_set_gastro_manager, lata_set_gastro, lata_admin_create_user, lata_set_guest: siehe schema_lata.sql
alter policy events_select on public."lata-events" using (public.lata_is_member() and (not is_private or created_by = auth.uid()));
alter policy event_assignees_select on public."lata-event_assignees" using (public.lata_is_member() and exists (select 1 from public."lata-events" e where e.id = event_id));
alter policy event_responses_select on public."lata-event_responses" using (public.lata_is_member() and exists (select 1 from public."lata-events" e where e.id = event_id));
alter policy tasks_select on public."lata-tasks" using (public.lata_is_member() and (not is_private or created_by = auth.uid()));
alter policy task_assignees_select on public."lata-task_assignees" using (public.lata_is_member() and exists (select 1 from public."lata-tasks" t where t.id = task_id));
alter policy tasks_insert on public."lata-tasks" with check (public.lata_is_member() and created_by = auth.uid());
