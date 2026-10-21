-- Gastronomien als Daten: Tabelle lata-gastros (statt fest eingebauter Seite), Schalter im Admin, Produkte je Seite (shop) eindeutig.
-- Voraussetzung: upgrade_ilmio.sql. Der Eintrag 'ilmio' (Il Mio Quattro) übernimmt den Zustand des früheren Modul-Schalters.
create table if not exists public."lata-gastros" (
  key text primary key check (key ~ '^[a-z0-9_]{2,30}$' and key <> 'einkauf'),
  name text not null check (char_length(name) between 1 and 60),
  enabled boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public."lata-gastros" enable row level security;
create policy gastros_select on public."lata-gastros" for select to authenticated using (public.lata_is_user());
revoke all on public."lata-gastros" from anon;
revoke insert, update, delete on public."lata-gastros" from authenticated;
insert into public."lata-gastros" (key, name, enabled)
values ('ilmio', 'Il Mio Quattro', coalesce((select value = '1' from public."lata-app_settings" where key = 'module_il_mio_quattro'), false))
on conflict (key) do nothing;
-- Funktionen lata_set_gastro, lata_add_gastro und lata_add_product_in (mit Prüfung gegen lata-gastros): siehe schema_lata.sql
create unique index if not exists "lata-products_shop_name_pub"  on public."lata-products" (shop, lower(btrim(name))) where not is_private;
create unique index if not exists "lata-products_shop_name_priv" on public."lata-products" (shop, lower(btrim(name)), created_by) where is_private;
-- Aufräumen im SQL-Editor (drop): alte globale Namens-Indizes und das frühere Modul-System
--   drop index if exists public."lata-products_name_pub_key";
--   drop index if exists public."lata-products_name_priv_key";
--   drop function if exists public.lata_modules();
--   drop function if exists public.lata_set_module(text, boolean);
