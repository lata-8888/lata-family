-- Ein Produkt gehört immer zur gleichen Einkaufsliste (lata-products.list_id); wer sie ändert, ändert sie für alle.
alter table public."lata-products" add column if not exists list_id uuid references public."lata-shop_lists"(id) on delete set null;

-- Bestehende Zuteilungen übernehmen: pro Produkt die früheste Liste eines Wunsches
update public."lata-products" p set list_id = (
  select w.list_id from public."lata-wishes" w where w.product_id = p.id and w.list_id is not null order by w.created_at limit 1
) where exists (select 1 from public."lata-wishes" w2 where w2.product_id = p.id and w2.list_id is not null) and p.list_id is null;

-- Wünsche folgen der Liste des Produkts (öffentliche Liste: alle; private Liste: nur die Besitzerin/der Besitzer)
update public."lata-wishes" w set list_id = p.list_id
from public."lata-products" p, public."lata-shop_lists" l
where w.product_id = p.id and l.id = p.list_id and w.list_id is distinct from p.list_id and (not l.is_private or w.user_id = l.owner_id);

-- Liste eines Produkts ändern: gilt für alle, unabhängig davon, wer es bestellt
create or replace function public.lata_set_product_list(p_product uuid, p_list uuid) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); pr record; lst record;
begin
  if not public.lata_is_user() then raise exception 'Nicht angemeldet'; end if;
  select * into pr from public."lata-products" where id = p_product;
  if not found or (pr.is_private and pr.created_by is distinct from me) then raise exception 'NEED_FORBIDDEN'; end if;
  if p_list is not null then
    select * into lst from public."lata-shop_lists" where id = p_list;
    if not found or not public.lata_can_see_list(p_list) or lst.shop <> pr.shop then raise exception 'NEED_FORBIDDEN'; end if;
  end if;
  update public."lata-products" set list_id = p_list where id = p_product;
  update public."lata-wishes" w set list_id = case when p_list is null then null when not lst.is_private or w.user_id = lst.owner_id then p_list else null end
  where w.product_id = p_product;
end; $$;
revoke execute on function public.lata_set_product_list(uuid, uuid) from public, anon;
grant execute on function public.lata_set_product_list(uuid, uuid) to authenticated;

-- Produkt (falls neu) in der Seite p_shop anlegen und für die gewählten Personen zum Favoriten machen. Ein Produkt gehört immer zur gleichen
-- Einkaufsliste (lata-products.list_id); hat es noch keine, wird die angegebene seine Liste. Die Wünsche übernehmen sie.
create or replace function public.lata_add_product_in(p_shop text, p_name text, p_note text, p_list uuid, p_users uuid[], p_private boolean default false) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); nm text := btrim(coalesce(p_name, '')); pid uuid; u uuid; users uuid[]; priv boolean := coalesce(p_private, false); plist uuid; lpriv boolean; lowner uuid;
begin
  if not public.lata_is_user() then raise exception 'Nicht angemeldet'; end if;
  if p_shop <> 'einkauf' and not exists (select 1 from public."lata-gastros" where key = p_shop) then raise exception 'Unbekannte Seite'; end if;
  if char_length(nm) not between 1 and 80 then raise exception 'Name fehlt'; end if;
  if not public.lata_can_see_list(p_list) then raise exception 'NEED_FORBIDDEN'; end if;
  select id into pid from public."lata-products" where shop = p_shop and lower(btrim(name)) = lower(nm) and (case when priv then is_private and created_by = me else not is_private end);
  if pid is null then
    insert into public."lata-products" (shop, name, created_by, is_private) values (p_shop, nm, me, priv) on conflict do nothing returning id into pid;
    if pid is null then select id into pid from public."lata-products" where shop = p_shop and lower(btrim(name)) = lower(nm) and (case when priv then is_private and created_by = me else not is_private end); end if;
  end if;
  select list_id into plist from public."lata-products" where id = pid;
  if plist is null and p_list is not null then update public."lata-products" set list_id = p_list where id = pid; plist := p_list; end if;
  select is_private, owner_id into lpriv, lowner from public."lata-shop_lists" where id = plist;
  users := case when priv or p_users is null then array[me] else p_users end;
  foreach u in array users loop
    if not exists (select 1 from public."lata-profiles" where id = u) then raise exception 'Person nicht gefunden'; end if;
    insert into public."lata-wishes" (product_id, user_id, created_by, note, list_id, selected)
    values (pid, u, me, nullif(btrim(coalesce(p_note, '')), ''), case when plist is null then null when not coalesce(lpriv, false) or u = lowner then plist else null end, false)
    on conflict (product_id, user_id) do nothing;
  end loop;
  return pid;
end; $$;
