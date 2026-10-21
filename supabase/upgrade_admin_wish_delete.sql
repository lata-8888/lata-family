-- Admins dürfen fremde Favoriten entfernen (nicht von privaten Produkten)
alter policy wishes_delete on public."lata-wishes"
  using (user_id = auth.uid() or (public.lata_is_admin() and exists (select 1 from public."lata-products" p where p.id = product_id and not p.is_private)));
