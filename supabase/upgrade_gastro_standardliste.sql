-- Standard-Einkaufsliste je Gastronomie (lata-gastros.list_id): neue Produkte ohne Listenangabe hängen daran; neue Gastronomien bekommen eine eigene Liste.
alter table public."lata-gastros" add column if not exists list_id uuid references public."lata-shop_lists"(id) on delete set null;
update public."lata-gastros" g set list_id = (
  select l.id from public."lata-shop_lists" l where l.shop = g.key order by l.created_at limit 1
) where g.list_id is null;
-- Funktionen lata_add_product_in und lata_add_gastro: siehe schema_lata.sql
