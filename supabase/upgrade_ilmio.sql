-- «Il Mio Quattro»: Klon der Einkauf-Seite mit eigenem Katalog. Produkte und Einkaufslisten gehören zu einer Seite (shop), Produkte können eine
-- externe Nummer (ref), Zutaten (info) und einen Preis haben. Die Pizzakarte wird als Katalog der Seite «ilmio» eingespielt.
alter table public."lata-products"   add column if not exists shop text not null default 'einkauf';
alter table public."lata-products"   add column if not exists ref text;
alter table public."lata-products"   add column if not exists info text;
alter table public."lata-products"   add column if not exists price numeric(8,2);
alter table public."lata-shop_lists" add column if not exists shop text not null default 'einkauf';

-- Produkt (falls neu) in der Seite p_shop anlegen und für die gewählten Personen zum Favoriten machen
create or replace function public.lata_add_product_in(p_shop text, p_name text, p_note text, p_list uuid, p_users uuid[], p_private boolean default false) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); nm text := btrim(coalesce(p_name, '')); pid uuid; u uuid; users uuid[]; pub boolean; priv boolean := coalesce(p_private, false);
begin
  if not public.lata_is_user() then raise exception 'Nicht angemeldet'; end if;
  if p_shop not in ('einkauf', 'ilmio') then raise exception 'Unbekannte Seite'; end if;
  if char_length(nm) not between 1 and 80 then raise exception 'Name fehlt'; end if;
  if not public.lata_can_see_list(p_list) then raise exception 'NEED_FORBIDDEN'; end if;
  pub := not priv and (p_list is null or exists (select 1 from public."lata-shop_lists" where id = p_list and not is_private));
  select id into pid from public."lata-products" where shop = p_shop and lower(btrim(name)) = lower(nm) and (case when priv then is_private and created_by = me else not is_private end);
  if pid is null then
    insert into public."lata-products" (shop, name, created_by, is_private) values (p_shop, nm, me, priv) on conflict do nothing returning id into pid;
    if pid is null then select id into pid from public."lata-products" where shop = p_shop and lower(btrim(name)) = lower(nm) and (case when priv then is_private and created_by = me else not is_private end); end if;
  end if;
  users := case when priv or p_users is null then array[me] else p_users end;
  foreach u in array users loop
    if not exists (select 1 from public."lata-profiles" where id = u) then raise exception 'Person nicht gefunden'; end if;
    insert into public."lata-wishes" (product_id, user_id, created_by, note, list_id, selected)
    values (pid, u, me, nullif(btrim(coalesce(p_note, '')), ''), case when u = me or pub then p_list end, false)
    on conflict (product_id, user_id) do nothing;
  end loop;
  return pid;
end; $$;
create or replace function public.lata_add_product(p_name text, p_note text, p_list uuid, p_users uuid[], p_private boolean default false) returns uuid
language sql security definer set search_path = public as $$ select public.lata_add_product_in('einkauf', p_name, p_note, p_list, p_users, p_private) $$;
revoke execute on function public.lata_add_product_in(text, text, text, uuid, uuid[], boolean) from public, anon;
grant execute on function public.lata_add_product_in(text, text, text, uuid, uuid[], boolean) to authenticated;

-- Pizzakarte (Katalog der Seite «ilmio»; die Nummer bleibt vorerst unsichtbar)
insert into public."lata-products" (shop, ref, name, info, price)
select 'ilmio', v.ref, v.name, v.info, v.price from (values
  ('1', 'Margherita', 'Tomatensauce, Mozzarella, Oregano', 18),
  ('2', 'Funghi', 'Tomatensauce, Mozzarella, Oregano, Champignons', 19.5),
  ('3', 'Gorgonzola', 'Tomatensauce, Mozzarella, Oregano, Gorgonzola', 21.5),
  ('4', 'Napolitana', 'Tomatensauce, Mozzarella, Oregano, Sardellen, Kapern, Oliven', 21.5),
  ('5', 'Prosciutto', 'Tomatensauce, Mozzarella, Oregano, Vorderschinken', 21.5),
  ('6', 'Prosciutto ai funghi', 'Tomatensauce, Mozzarella, Oregano, Vorderschinken, Champignons', 22.5),
  ('7', 'Hawaii', 'Tomatensauce, Mozzarella, Oregano, Vorderschinken, Ananas', 22.5),
  ('8', 'Tonno', 'Tomatensauce, Mozzarella, Oliven, Zwiebeln, Thunfisch', 23.5),
  ('9', 'Pollo', 'Tomatensauce, Mozzarella, Oregano, Champignons, Knoblauch, Pouletbrust', 24.5),
  ('10', 'Toscana', 'Tomatensauce, Mozzarella, Oregano, scharfem Salami, Zwiebeln', 22.5),
  ('11', 'Quattro Formaggi', 'Tomatensauce, Oregano, 4 verschiedenen Käsesorten', 23.5),
  ('12', 'Mama Lucia', 'Tomatensauce, Mozzarella, Oregano, Champignons, diverse Gemüse, gekochtem Ei', 24),
  ('13', 'Frutti di Mare', 'Tomatensauce, Mozzarella, Oregano, Rauchlachs, Meeresfrüchte, Sardellen', 23.5),
  ('14', 'Rusticana', 'Tomatensauce, Mozzarella, Oregano, Rohschinken, Champignons', 23.5),
  ('15', 'Calzone (ripieno)', 'Tomatensauce, Mozzarella, Oregano, Vorderschinken, Spinat, Ei, Pesto, Parmesan', 24.5),
  ('16', 'Quattro Stagione', 'Tomatensauce, Mozzarella, Oregano, Champignons, Vorderschinken, Artischocken, Peperoni', 24.5),
  ('17', 'Diavolo', 'Tomatensauce, Mozzarella, Oregano, Hackfleisch, Champignons, Peperoncini, Knoblauch', 25.5),
  ('18', 'Ventinove', 'Tomatensauce, Mozzarella, Oregano, Speck, gekochtem Ei, Spinat, Zwiebeln', 25.5),
  ('19', 'Marco Polo', 'Tomatensauce, Mozzarella, Oregano, Rauchlachs, Crevetten, Spinat', 24.5),
  ('20', 'Angelo', 'Tomatensauce, Mozzarella, Oregano, Rucola, Rohschinken, Grana Padano', 24.5),
  ('21', 'Padrone', 'Tomatensauce, Mozzarella, Oregano, Kalbfleisch, Knoblauch, Zwiebeln', 26.5),
  ('22', 'Costa Smeralda', 'Tomatensauce, Mozzarella, Oregano, Lachsfilet, Riesencrevetten, Knoblauch', 25.5),
  ('23', 'Il mio Quattro', 'Tomatensauce, Mozzarella, Oregano, Vorderschinken, scharfem Salami, Speck, Rohschinken', 26.5)
) as v(ref, name, info, price)
where not exists (select 1 from public."lata-products" p where p.shop = 'ilmio' and p.ref = v.ref);
