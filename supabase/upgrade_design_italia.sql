-- Design «Italia»: Liste der erlaubten Designs erweitern (nach upgrade_design_lila.sql).
-- ACHTUNG: «drop constraint» ggf. im SQL-Editor ausführen (der MCP läuft bei drop oft ins Zeitlimit).
alter table public."lata-profiles" drop constraint if exists "lata-profiles_design_check";
alter table public."lata-profiles" add constraint "lata-profiles_design_check" check (design is null or design in ('standard','holland','light','petrol','lila','italia'));

create or replace function public.lata_set_app_design(p_design text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.lata_is_admin() then raise exception 'Nur Admins'; end if;
  if p_design not in ('standard', 'holland', 'light', 'petrol', 'lila', 'italia') then raise exception 'Ungültiges Design'; end if;
  insert into public."lata-app_settings" (key, value) values ('design', p_design)
  on conflict (key) do update set value = excluded.value;
end; $$;

-- Prüfen (muss 'italia' enthalten):
select pg_get_constraintdef(oid) from pg_constraint where conname = 'lata-profiles_design_check';
