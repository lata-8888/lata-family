-- Einmaliges Upgrade für Projekte, die noch das alte Einkaufsmodell haben (lata-needs / lata-need_assignees).
-- Neue Projekte brauchen das nicht: supabase/schema_lata.sql genügt. Reihenfolge: zuerst schema_lata.sql, dann diese Datei.
-- Enthält «drop»-Befehle: im Supabase SQL-Editor ausführen.

-- ===== Einmalige Datenübernahme aus dem alten Modell (lata-needs / lata-need_assignees) =====
do $$ begin
  if to_regclass('public."lata-needs"') is not null then
    if not exists (select 1 from public."lata-products") then
      insert into public."lata-products" (id, name, created_by, created_at)
      select distinct on (lower(btrim(name))) id, btrim(name), owner_id, created_at
        from public."lata-needs" order by lower(btrim(name)), created_at;
      insert into public."lata-wishes" (product_id, user_id, created_by, note, list_id, selected, checked)
      select p.id, u.user_id, n.owner_id, n.note, n.list_id, n.selected, n.checked
        from public."lata-needs" n
        join public."lata-products" p on lower(btrim(p.name)) = lower(btrim(n.name))
        cross join lateral (
          select a.user_id from public."lata-need_assignees" a where a.need_id = n.id
          union select n.owner_id where not exists (select 1 from public."lata-need_assignees" a where a.need_id = n.id)) u
       where n.active
      on conflict (product_id, user_id) do nothing;
    end if;
    -- alte Tabellen bleiben als Sicherung (ohne Zugriff, ohne Realtime); später mit drop table entfernen
    drop trigger if exists guard_need_update on public."lata-needs";
    if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'lata-needs') then
      alter publication supabase_realtime drop table public."lata-needs"; end if;
    if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'lata-need_assignees') then
      alter publication supabase_realtime drop table public."lata-need_assignees"; end if;
    alter table public."lata-needs" rename to "lata-needs_legacy";
    alter table public."lata-need_assignees" rename to "lata-need_assignees_legacy";
    revoke all on public."lata-needs_legacy", public."lata-need_assignees_legacy" from anon, authenticated;
  end if;
end $$;
drop function if exists public.lata_can_see_need(uuid);
drop function if exists public.lata_owns_need(uuid);
drop function if exists public.lata_is_need_assignee(uuid);
drop function if exists public.lata_guard_need_update();
drop trigger if exists cleanup_product on public."lata-wishes";
drop function if exists public.lata_cleanup_product();   -- war kurz im Einsatz, Produkte werden nicht mehr automatisch gelöscht


-- Altlasten entfernen (Policies/Trigger der Sicherungstabellen zuerst, sonst scheitern die Funktionen an Abhängigkeiten)
drop policy if exists needs_select on public."lata-needs_legacy";
drop policy if exists needs_insert on public."lata-needs_legacy";
drop policy if exists needs_update on public."lata-needs_legacy";
drop policy if exists needs_delete on public."lata-needs_legacy";
drop policy if exists need_assignees_select   on public."lata-need_assignees_legacy";
drop policy if exists need_assignees_self_add on public."lata-need_assignees_legacy";
drop policy if exists need_assignees_self_del on public."lata-need_assignees_legacy";
drop policy if exists need_assignees_write    on public."lata-need_assignees_legacy";
drop trigger if exists guard_need_update on public."lata-needs_legacy";
drop trigger if exists cleanup_product on public."lata-wishes";
drop function if exists public.lata_cleanup_product();
drop function if exists public.lata_set_wishers(uuid, uuid[], text, uuid);
drop function if exists public.lata_can_see_need(uuid);
drop function if exists public.lata_owns_need(uuid);
drop function if exists public.lata_is_need_assignee(uuid);
drop function if exists public.lata_guard_need_update();
drop function if exists public.lata_list_update(uuid, boolean);
-- Sicherungstabellen erst löschen, wenn nicht mehr gebraucht:
-- drop table public."lata-need_assignees_legacy", public."lata-needs_legacy";
