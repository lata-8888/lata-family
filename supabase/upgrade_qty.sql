-- Anzahl je Wunsch (Gastronomie-Seiten): lata-wishes.qty
alter table public."lata-wishes" add column if not exists qty integer not null default 1;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'lata-wishes_qty_range') then
    alter table public."lata-wishes" add constraint "lata-wishes_qty_range" check (qty between 1 and 99);
  end if;
end $$;
-- Die Anzahl ändert nur die Person selbst: lata_guard_wish_update (siehe schema_lata.sql) prüft qty mit.
