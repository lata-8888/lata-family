-- Privat: Events, Tasks und Produkte können als «privat» markiert werden und sind dann nur der Person sichtbar, die sie angelegt hat
-- (auch nicht für Admins). Idempotent; ändert nur lata-Objekte. Policies per ALTER (kein DROP nötig).

alter table public."lata-events"   add column if not exists is_private boolean not null default false;
alter table public."lata-events"   add column if not exists created_by uuid references public."lata-profiles"(id) on delete set null default auth.uid();
alter table public."lata-tasks"    add column if not exists is_private boolean not null default false;
alter table public."lata-products" add column if not exists is_private boolean not null default false;

-- Produktnamen: öffentlich global eindeutig, privat je Person eindeutig (alter Index "lata-products_name_key" danach entfernen)
create unique index if not exists "lata-products_name_pub_key"  on public."lata-products" (lower(btrim(name))) where not is_private;
create unique index if not exists "lata-products_name_priv_key" on public."lata-products" (lower(btrim(name)), created_by) where is_private;

-- Events
alter policy events_select on public."lata-events" using (public.lata_is_user() and (not is_private or created_by = auth.uid()));
alter policy events_manage on public."lata-events"
  using (public.lata_can_manage_events() and (not is_private or created_by = auth.uid()))
  with check (public.lata_can_manage_events() and (not is_private or created_by = auth.uid()));
alter policy event_assignees_select on public."lata-event_assignees"
  using (public.lata_is_user() and exists (select 1 from public."lata-events" e where e.id = event_id));
alter policy event_assignees_manage on public."lata-event_assignees"
  using (public.lata_can_manage_events() and exists (select 1 from public."lata-events" e where e.id = event_id))
  with check (public.lata_can_manage_events() and exists (select 1 from public."lata-events" e where e.id = event_id and (not e.is_private or user_id = auth.uid())));
alter policy event_assignees_add_any on public."lata-event_assignees"
  with check (public.lata_is_user() and exists (select 1 from public."lata-events" e where e.id = event_id and (not e.is_private or user_id = auth.uid())));
alter policy event_assignees_own_write on public."lata-event_assignees"
  using (user_id = auth.uid() and public.lata_is_user() and exists (select 1 from public."lata-events" e where e.id = event_id))
  with check (user_id = auth.uid() and public.lata_is_user() and exists (select 1 from public."lata-events" e where e.id = event_id));
alter policy event_responses_select on public."lata-event_responses"
  using (public.lata_is_user() and exists (select 1 from public."lata-events" e where e.id = event_id));
alter policy event_responses_own_write on public."lata-event_responses"
  using (user_id = auth.uid() and public.lata_is_user() and exists (select 1 from public."lata-events" e where e.id = event_id))
  with check (user_id = auth.uid() and public.lata_is_user() and exists (select 1 from public."lata-events" e where e.id = event_id));

-- Tasks
alter policy tasks_select on public."lata-tasks" using (public.lata_is_user() and (not is_private or created_by = auth.uid()));
alter policy tasks_update on public."lata-tasks"
  using (public.lata_is_user() and (not is_private or created_by = auth.uid()) and (created_by = auth.uid() or public.lata_is_task_assignee(id) or public.lata_is_admin()))
  with check (public.lata_is_user() and (not is_private or created_by = auth.uid()) and (created_by = auth.uid() or public.lata_is_task_assignee(id) or public.lata_is_admin()));
alter policy tasks_delete on public."lata-tasks" using (created_by = auth.uid() or (public.lata_is_admin() and not is_private));
alter policy task_assignees_select on public."lata-task_assignees"
  using (public.lata_is_user() and exists (select 1 from public."lata-tasks" t where t.id = task_id));
alter policy task_assignees_add_any on public."lata-task_assignees"
  with check (public.lata_is_user() and exists (select 1 from public."lata-tasks" t where t.id = task_id and (not t.is_private or user_id = auth.uid())));
alter policy task_assignees_own_write on public."lata-task_assignees"
  using (user_id = auth.uid() and public.lata_is_user() and exists (select 1 from public."lata-tasks" t where t.id = task_id))
  with check (user_id = auth.uid() and public.lata_is_user() and exists (select 1 from public."lata-tasks" t where t.id = task_id));
alter policy task_assignees_manage on public."lata-task_assignees"
  using (public.lata_can_manage_task(task_id) and exists (select 1 from public."lata-tasks" t where t.id = task_id))
  with check (public.lata_can_manage_task(task_id) and exists (select 1 from public."lata-tasks" t where t.id = task_id and (not t.is_private or user_id = auth.uid())));

-- Produkte und Wünsche
alter policy products_select on public."lata-products" using (public.lata_is_user() and (not is_private or created_by = auth.uid()));
alter policy products_update on public."lata-products"
  using (public.lata_is_user() and (created_by = auth.uid() or (public.lata_is_admin() and not is_private)))
  with check (created_by = auth.uid() or (public.lata_is_admin() and not is_private));
alter policy products_delete on public."lata-products" using (public.lata_is_user() and (created_by = auth.uid() or (public.lata_is_admin() and not is_private)));
alter policy wishes_select on public."lata-wishes"
  using (public.lata_is_user() and (user_id = auth.uid() or public.lata_can_see_list(list_id)) and exists (select 1 from public."lata-products" p where p.id = product_id));
alter policy wishes_update on public."lata-wishes"
  using (public.lata_is_user() and (user_id = auth.uid() or public.lata_can_see_list(list_id)) and exists (select 1 from public."lata-products" p where p.id = product_id))
  with check (public.lata_can_see_list(list_id));

-- Ein Produkt wird erst privat, wenn niemand sonst es als Favorit führt
create or replace function public.lata_guard_product_private() returns trigger language plpgsql set search_path = public as $$
begin
  if new.is_private and not old.is_private and exists (select 1 from public."lata-wishes" w where w.product_id = new.id and w.user_id <> coalesce(new.created_by, auth.uid())) then
    raise exception 'PRIVATE_SHARED';
  end if;
  return new;
end; $$;
create or replace trigger guard_product_private before update on public."lata-products" for each row execute function public.lata_guard_product_private();

-- Produkt (falls neu) anlegen und für die gewählten Personen zum Favoriten machen; privat = nur für mich
create or replace function public.lata_add_product(p_name text, p_note text, p_list uuid, p_users uuid[], p_private boolean default false) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); nm text := btrim(coalesce(p_name, '')); pid uuid; u uuid; users uuid[]; pub boolean; priv boolean := coalesce(p_private, false);
begin
  if not public.lata_is_user() then raise exception 'Nicht angemeldet'; end if;
  if char_length(nm) not between 1 and 80 then raise exception 'Name fehlt'; end if;
  if not public.lata_can_see_list(p_list) then raise exception 'NEED_FORBIDDEN'; end if;
  pub := not priv and (p_list is null or exists (select 1 from public."lata-shop_lists" where id = p_list and not is_private));
  select id into pid from public."lata-products" where lower(btrim(name)) = lower(nm) and (case when priv then is_private and created_by = me else not is_private end);
  if pid is null then
    insert into public."lata-products" (name, created_by, is_private) values (nm, me, priv) on conflict do nothing returning id into pid;
    if pid is null then select id into pid from public."lata-products" where lower(btrim(name)) = lower(nm) and (case when priv then is_private and created_by = me else not is_private end); end if;
  end if;
  users := case when priv or p_users is null then array[me] else p_users end;   -- privat: nur ich
  foreach u in array users loop
    if not exists (select 1 from public."lata-profiles" where id = u) then raise exception 'Person nicht gefunden'; end if;
    insert into public."lata-wishes" (product_id, user_id, created_by, note, list_id, selected)
    values (pid, u, me, nullif(btrim(coalesce(p_note, '')), ''), case when u = me or pub then p_list end, false)
    on conflict (product_id, user_id) do nothing;
  end loop;
  return pid;
end; $$;
create or replace function public.lata_add_wish(p_name text, p_note text, p_list uuid, p_users uuid[]) returns uuid
language sql security definer set search_path = public as $$ select public.lata_add_product(p_name, p_note, p_list, p_users, false) $$;
revoke execute on function public.lata_add_product(text, text, uuid, uuid[], boolean) from public, anon;
grant execute on function public.lata_add_product(text, text, uuid, uuid[], boolean) to authenticated;
