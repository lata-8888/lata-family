-- Je Gastronomie eine Einkaufsliste mit allen Produkten der Gastronomie (Eigentümer: erster Admin): «Barfüsser» und «Zum Siam».
-- Die Liste gehört zum Produkt (lata-products.list_id) und die Wünsche folgen ihr.
insert into public."lata-shop_lists" (name, owner_id, is_private, shop)
select v.name, (select id from public."lata-profiles" where is_admin order by created_at limit 1), false, v.shop
from (values ('Barfüsser', 'barfuesser'), ('Zum Siam', 'zum_siam')) as v(name, shop)
where not exists (select 1 from public."lata-shop_lists" l where l.shop = v.shop and lower(l.name) = lower(v.name));

update public."lata-products" p set list_id = l.id
from public."lata-shop_lists" l
where l.shop = p.shop and p.shop in ('barfuesser', 'zum_siam')
  and lower(l.name) = (case p.shop when 'barfuesser' then 'barfüsser' else 'zum siam' end)
  and p.list_id is distinct from l.id;

update public."lata-wishes" w set list_id = p.list_id
from public."lata-products" p
where p.id = w.product_id and p.shop in ('barfuesser', 'zum_siam') and w.list_id is distinct from p.list_id;
