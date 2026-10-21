-- Gruppe (Rubrik der Speisekarte) je Gastronomie-Produkt: lata-products.grp
alter table public."lata-products" add column if not exists grp text check (grp is null or char_length(grp) <= 60);
update public."lata-products" set grp = 'Pizzen' where shop = 'ilmio' and grp is null;
update public."lata-products" set grp = case
  when ref::int between 1 and 6 then 'Suppen'
  when ref::int between 10 and 23 then 'Vorspeisen'
  when ref::int between 30 and 37 then 'Salate'
  when ref::int between 40 and 48 then 'Fisch & Meeresfrüchte'
  when ref::int between 50 and 95 then 'Hauptspeisen Currygerichte'
  when ref::int between 100 and 115 then 'Gebratene Gerichte'
  when ref::int between 120 and 129 then 'Nudelgerichte'
  when ref::int between 130 and 134 then 'Reis'
  when ref::int between 140 and 143 then 'Beilagen'
end
where shop = 'zum_siam' and ref ~ '^[0-9]+$' and grp is null;
-- Barfüsser: Gruppe «Suppen» (Karte unter barfuesser.ch/de/speisekarte; Beschreibungen auf der Kartenansicht abgeschnitten, mit «…»)
insert into public."lata-products" (shop, grp, name, info, price)
select 'barfuesser', v.grp, v.name, v.info, v.price from (values
  ('Suppen', 'Miso-Suppe', 'Wakame, Lauch, Tofu', 9.00),
  ('Suppen', 'Spicy Fish Suppe', 'Sashimi-Würfel, Avocado, Spinat, Chili- und Sesamöl in Miso-Suppe …', 16.50),
  ('Suppen', 'Spicy Veggie Suppe', 'Avocado, Spinat, grüner Spargel, geräucherter Tofu, Inari, Shinko, Chili- und Sesamöl in Miso-Suppe …', 14.50)
) as v(grp, name, info, price)
where not exists (select 1 from public."lata-products" p where p.shop = 'barfuesser' and lower(p.name) = lower(v.name));
