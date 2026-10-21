-- Hauptseite «Il Mio Quattro» (Gruppe Gastronomie im Admin): Modul-Schalter
-- Module (Hauptseiten, die der Admin ein-/ausschaltet): Schlüssel «module_<name>» in lata-app_settings, Wert '1' = an
create or replace function public.lata_modules() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_object_agg(substr(key, 8), value = '1') from public."lata-app_settings" where key like 'module\_%'), '{}'::jsonb)
$$;
create or replace function public.lata_set_module(p_key text, p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.lata_is_admin() then raise exception 'Nur Admins'; end if;
  if p_key not in ('il_mio_quattro') then raise exception 'Unbekanntes Modul'; end if;
  insert into public."lata-app_settings" (key, value) values ('module_' || p_key, case when p_on then '1' else '0' end)
  on conflict (key) do update set value = excluded.value;
end; $$;
revoke execute on function public.lata_modules(), public.lata_set_module(text, boolean) from public, anon;
grant execute on function public.lata_modules(), public.lata_set_module(text, boolean) to authenticated;
