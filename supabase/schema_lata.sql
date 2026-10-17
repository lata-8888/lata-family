-- Family (lata) – Schema. Angewendet auf das Projekt «lata-family» (yiynvyqvkbkwamxopemj); APP_TMPL_DEV wird nach Entscheid nachgezogen.
-- Idempotent: darf mehrfach ausgeführt werden. Tabellen "lata-*", Funktionen "lata_*". Keine Personendaten ausser dem Default-Admin.
-- Projekte mit dem alten Einkaufsmodell (lata-needs) zusätzlich: supabase/upgrade_from_needs.sql.
-- EMAIL_DOMAIN unten MUSS zu config.js passen und darf nachträglich nie geändert werden.

create extension if not exists pgcrypto with schema extensions;

-- ===== Tabellen =====
create table if not exists public."lata-app_settings" (key text primary key, value text not null);
insert into public."lata-app_settings" (key, value) values
  ('email_domain', 'app-template-dev.example'), ('design', 'standard'), ('language', 'de')
on conflict (key) do nothing;

create table if not exists public."lata-profiles" (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text not null unique check (phone ~ '^\+[0-9]{9,15}$'),
  is_admin boolean not null default false,
  language text check (language in ('de','en','nl')),
  theme text check (theme in ('light','dark')),
  pin_changed boolean not null default false,
  created_at timestamptz not null default now(),
  is_guest boolean not null default false,
  is_event_manager boolean not null default false,
  design text check (design is null or design in ('standard','holland','light','petrol'))
);

create table if not exists public."lata-events" (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  place text,
  starts_at timestamptz not null,
  created_at timestamptz not null default now(),
  rsvp boolean not null default false,
  series_id uuid,
  time_set boolean not null default true,
  series_open boolean not null default false,
  series_rule jsonb,
  comment text
);
create index if not exists "lata-events_series_idx" on public."lata-events" (series_id);

create table if not exists public."lata-event_assignees" (
  event_id uuid not null references public."lata-events"(id) on delete cascade,
  user_id uuid not null references public."lata-profiles"(id) on delete cascade,
  primary key (event_id, user_id)
);
create table if not exists public."lata-event_responses" (
  event_id uuid not null references public."lata-events"(id) on delete cascade,
  user_id uuid not null references public."lata-profiles"(id) on delete cascade,
  answer text not null check (answer in ('yes','no')),
  primary key (event_id, user_id)
);

create table if not exists public."lata-tasks" (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  note text check (note is null or char_length(note) <= 500),
  created_by uuid not null references public."lata-profiles"(id),
  due_date date,   -- Termin optional
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
-- Favorit eines Tasks = zugeteilte Person (mehrere möglich)
create table if not exists public."lata-task_assignees" (
  task_id uuid not null references public."lata-tasks"(id) on delete cascade,
  user_id uuid not null references public."lata-profiles"(id) on delete cascade,
  primary key (task_id, user_id)
);
create index if not exists "lata-task_assignees_user_idx" on public."lata-task_assignees" (user_id);

create table if not exists public."lata-recurring_tasks" (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  note text check (note is null or char_length(note) <= 500),
  assigned_to uuid not null references public."lata-profiles"(id),
  created_by uuid not null references public."lata-profiles"(id),
  freq text not null check (freq in ('daily','weekly','monthly')),
  weekday int check (weekday between 1 and 7),
  month_day int check (month_day between 1 and 28),
  start_date date not null default current_date,
  next_due date not null default current_date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public."lata-shop_lists" (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  owner_id uuid not null references public."lata-profiles"(id),
  is_private boolean not null default false,
  created_at timestamptz not null default now()
);
-- Produktkatalog: jedes Produkt genau einmal (Name ohne Gross-/Kleinschreibung und Randleerzeichen eindeutig)
create table if not exists public."lata-products" (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  created_by uuid references public."lata-profiles"(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists "lata-products_name_key" on public."lata-products" (lower(btrim(name)));

-- Wunscheintrag: eine Person führt ein Produkt auf ihrer Wunschliste, optional in einer Einkaufsliste
create table if not exists public."lata-wishes" (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public."lata-products"(id) on delete cascade,
  user_id uuid not null references public."lata-profiles"(id) on delete cascade,
  created_by uuid references public."lata-profiles"(id) on delete set null,
  note text check (note is null or char_length(note) <= 80),
  list_id uuid references public."lata-shop_lists"(id) on delete set null,
  selected boolean not null default false,   -- auf der Einkaufsliste (Favorit angetickt)
  checked boolean not null default false,    -- gekauft/abgehakt
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);
alter table public."lata-wishes" alter column selected set default false;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'lata-wishes_checked_needs_selected') then
    alter table public."lata-wishes" add constraint "lata-wishes_checked_needs_selected" check (not checked or selected);
  end if;
end $$;
create index if not exists "lata-wishes_user_idx" on public."lata-wishes" (user_id);
create index if not exists "lata-wishes_list_idx" on public."lata-wishes" (list_id);

-- ===== Hilfsfunktionen (security definer, fester search_path) =====
create or replace function public.lata_default_admin_phone() returns text language sql immutable as $$ select '+41796232345'::text $$;

create or replace function public.lata_is_admin() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select is_admin from public."lata-profiles" where id = auth.uid()), false) $$;
create or replace function public.lata_is_user() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from public."lata-profiles" where id = auth.uid()) $$;
create or replace function public.lata_can_manage_events() returns boolean language sql stable security definer set search_path = public as
$$ select coalesce((select is_admin or is_event_manager from public."lata-profiles" where id = auth.uid()), false) $$;
create or replace function public.lata_app_design() returns text language sql stable security definer set search_path = public as
$$ select coalesce((select value from public."lata-app_settings" where key = 'design'), 'standard') $$;
create or replace function public.lata_app_language() returns text language sql stable security definer set search_path = public as
$$ select coalesce((select value from public."lata-app_settings" where key = 'language'), 'de') $$;

create or replace function public.lata_can_see_list(p_list uuid) returns boolean language sql stable security definer set search_path = public as $$
  select p_list is null or exists (
    select 1 from public."lata-shop_lists" l where l.id = p_list and (not l.is_private or l.owner_id = auth.uid())) $$;
create or replace function public.lata_can_manage_task(p_task uuid) returns boolean language sql stable security definer set search_path = public as $$
  select public.lata_is_admin() or exists (select 1 from public."lata-tasks" where id = p_task and created_by = auth.uid()) $$;
create or replace function public.lata_is_task_assignee(p_task uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public."lata-task_assignees" where task_id = p_task and user_id = auth.uid()) $$;
-- Wiederkehrende Tasks: Fälligkeitsberechnung
create or replace function public.lata_next_due(p_freq text, p_weekday int, p_month_day int, p_from date) returns date language plpgsql immutable as $$
declare d date;
begin
  if p_freq = 'daily' then return p_from;
  elsif p_freq = 'weekly' then
    return p_from + ((coalesce(p_weekday, 1) - extract(isodow from p_from)::int + 7) % 7);
  else
    d := make_date(extract(year from p_from)::int, extract(month from p_from)::int, coalesce(p_month_day, 1));
    if d < p_from then
      d := (date_trunc('month', p_from) + interval '1 month')::date + (coalesce(p_month_day, 1) - 1);
    end if;
    return d;
  end if;
end; $$;
create or replace function public.lata_advance_due(p_freq text, p_weekday int, p_month_day int, p_d date) returns date language plpgsql immutable as $$
begin
  if p_freq = 'daily' then return p_d + 1;
  elsif p_freq = 'weekly' then return p_d + 7;
  else return public.lata_next_due('monthly', p_weekday, p_month_day, (date_trunc('month', p_d) + interval '1 month')::date);
  end if;
end; $$;

-- ===== Trigger-Funktionen =====
create or replace function public.lata_guard_default_admin() returns trigger language plpgsql as $$
begin
  if old.phone = public.lata_default_admin_phone() and (new.is_admin is not true or new.phone <> old.phone) then
    raise exception 'DEFAULT_ADMIN_PROTECTED';
  end if;
  return new;
end; $$;

create or replace function public.lata_guard_task_update() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if new.created_by <> old.created_by then raise exception 'TASK_FORBIDDEN'; end if;
  if not (old.created_by = auth.uid() or public.lata_is_admin()) then
    if new.title is distinct from old.title or new.note is distinct from old.note or new.due_date is distinct from old.due_date then
      raise exception 'TASK_FORBIDDEN';
    end if;
  end if;
  if new.done and not old.done then new.done_at := now();
  elsif not new.done then new.done_at := null; end if;
  return new;
end; $$;

-- bewusst NICHT security definer: current_user muss die Rolle der Sitzung sein (authenticated) bzw. der Funktionsbesitzer bei RPC-Aufrufen
create or replace function public.lata_guard_wish_update() returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is null or current_user not in ('authenticated', 'anon') then return new; end if;
  if new.product_id <> old.product_id or new.user_id <> old.user_id then raise exception 'NEED_FORBIDDEN'; end if;
  if auth.uid() = old.user_id then return new; end if;   -- die Person ändert ihren Wunsch frei; alle anderen dürfen nur abhaken
  if new.selected <> old.selected or new.note is distinct from old.note or new.list_id is distinct from old.list_id then
    raise exception 'NEED_FORBIDDEN';
  end if;
  return new;
end; $$;

create or replace function public.lata_recurring_set_next() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' or new.freq <> old.freq or new.weekday is distinct from old.weekday
     or new.month_day is distinct from old.month_day or new.start_date <> old.start_date then
    new.next_due := public.lata_next_due(new.freq, new.weekday, new.month_day, greatest(new.start_date, current_date));
  end if;
  return new;
end; $$;

create or replace trigger guard_default_admin before update on public."lata-profiles" for each row execute function public.lata_guard_default_admin();
create or replace trigger guard_task_update before update on public."lata-tasks" for each row execute function public.lata_guard_task_update();
create or replace trigger guard_wish_update before update on public."lata-wishes" for each row execute function public.lata_guard_wish_update();
create or replace trigger recurring_set_next before insert or update on public."lata-recurring_tasks" for each row execute function public.lata_recurring_set_next();

-- ===== Benutzer anlegen (Auth-Token-Spalten müssen '' sein, nie NULL) =====
create or replace function public.lata__create_user(p_name text, p_phone text, p_admin boolean) returns uuid
language plpgsql security definer set search_path = public, extensions, auth as $$
declare uid uuid; digits text; dom text; mail text;
begin
  select id into uid from public."lata-profiles" where phone = p_phone;
  if uid is not null then
    if p_admin then update public."lata-profiles" set is_admin = true where id = uid; end if;
    return uid;
  end if;
  select value into dom from public."lata-app_settings" where key = 'email_domain';
  digits := regexp_replace(p_phone, '\D', '', 'g');
  mail := digits || '@' || dom;
  select id into uid from auth.users where email = mail;
  if uid is null then
    uid := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new, email_change_token_current,
      reauthentication_token, phone_change, phone_change_token)
    values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail,
      crypt(right(digits, 6), gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('name', p_name, 'phone', p_phone), now(), now(),
      '', '', '', '', '', '', '', '');
    insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), uid::text, uid, jsonb_build_object('sub', uid::text, 'email', mail, 'email_verified', true), 'email', now(), now(), now());
  end if;
  insert into public."lata-profiles" (id, name, phone, is_admin) values (uid, trim(p_name), p_phone, p_admin);
  return uid;
end; $$;

-- ===== Admin- und Benutzer-RPCs =====
create or replace function public.lata_admin_create_user(p_name text, p_phone text, p_guest boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.lata_is_admin() then raise exception 'Nur Admins'; end if;
  if trim(coalesce(p_name, '')) = '' then raise exception 'Name fehlt'; end if;
  if coalesce(p_phone, '') !~ '^\+[0-9]{9,15}$' then raise exception 'Ungültige Handynummer'; end if;
  if exists (select 1 from public."lata-profiles" where phone = p_phone) then raise exception 'PHONE_TAKEN'; end if;
  uid := public.lata__create_user(p_name, p_phone, false);
  if coalesce(p_guest, false) then update public."lata-profiles" set is_guest = true where id = uid; end if;
end; $$;

create or replace function public.lata_admin_update_member(target uuid, new_name text, new_phone text) returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
declare old_phone text; old_email text; new_email text; digits text; shared boolean := false;
begin
  if not public.lata_is_admin() then raise exception 'Nur Admins'; end if;
  new_name := trim(coalesce(new_name, ''));
  if new_name = '' then raise exception 'Name fehlt'; end if;
  if coalesce(new_phone, '') !~ '^\+[0-9]{9,15}$' then raise exception 'Ungültige Handynummer'; end if;
  select phone into old_phone from public."lata-profiles" where id = target;
  if old_phone is null then raise exception 'Person nicht gefunden'; end if;
  if new_phone <> old_phone then
    if old_phone = public.lata_default_admin_phone() then raise exception 'DEFAULT_ADMIN_PROTECTED'; end if;
    if exists (select 1 from public."lata-profiles" where phone = new_phone and id <> target) then raise exception 'PHONE_TAKEN'; end if;
    if to_regclass('public.profiles') is not null then
      execute 'select exists (select 1 from public.profiles where id = $1)' into shared using target;
      if shared then raise exception 'PHONE_SHARED'; end if;
    end if;
    select email into old_email from auth.users where id = target;
    digits := regexp_replace(new_phone, '\D', '', 'g');
    new_email := digits || '@' || split_part(old_email, '@', 2);
    update auth.users set email = new_email, encrypted_password = crypt(right(digits, 6), gen_salt('bf')),
           raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('phone', new_phone, 'name', new_name)
     where id = target;
    update auth.identities set identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', new_email)
     where user_id = target and provider = 'email';
    update public."lata-profiles" set pin_changed = false where id = target;
  end if;
  update public."lata-profiles" set name = new_name, phone = new_phone where id = target;
end; $$;

create or replace function public.lata_update_own_phone(new_phone text) returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
declare me uuid := auth.uid(); old_phone text; old_email text; new_email text; digits text; pname text; shared boolean := false;
begin
  if me is null or not public.lata_is_user() then raise exception 'Nicht angemeldet'; end if;
  if coalesce(new_phone, '') !~ '^\+[0-9]{9,15}$' then raise exception 'Ungültige Handynummer'; end if;
  select phone, name into old_phone, pname from public."lata-profiles" where id = me;
  if old_phone is null then raise exception 'Person nicht gefunden'; end if;
  if new_phone = old_phone then return; end if;
  if old_phone = public.lata_default_admin_phone() then raise exception 'DEFAULT_ADMIN_PROTECTED'; end if;
  if exists (select 1 from public."lata-profiles" where phone = new_phone and id <> me) then raise exception 'PHONE_TAKEN'; end if;
  if to_regclass('public.profiles') is not null then
    execute 'select exists (select 1 from public.profiles where id = $1)' into shared using me;
    if shared then raise exception 'PHONE_SHARED'; end if;
  end if;
  select email into old_email from auth.users where id = me;
  digits := regexp_replace(new_phone, '\D', '', 'g');
  new_email := digits || '@' || split_part(old_email, '@', 2);
  update auth.users set email = new_email, encrypted_password = crypt(right(digits, 6), gen_salt('bf')),
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('phone', new_phone, 'name', pname)
   where id = me;
  update auth.identities set identity_data = coalesce(identity_data, '{}'::jsonb) || jsonb_build_object('email', new_email)
   where user_id = me and provider = 'email';
  update public."lata-profiles" set phone = new_phone, pin_changed = false where id = me;
end; $$;

create or replace function public.lata_remove_member(target uuid) returns void
language plpgsql security definer set search_path = public, auth as $$
declare keep boolean := false;
begin
  if not public.lata_is_admin() then raise exception 'Nur Admins'; end if;
  if target = auth.uid() then raise exception 'Du kannst dich nicht selbst entfernen'; end if;
  if exists (select 1 from public."lata-profiles" where id = target and phone = public.lata_default_admin_phone()) then
    raise exception 'DEFAULT_ADMIN_PROTECTED';
  end if;
  delete from public."lata-profiles" where id = target;
  if to_regclass('public.profiles') is not null then
    execute 'select exists (select 1 from public.profiles where id = $1)' into keep using target;
  end if;
  if not keep then delete from auth.users where id = target; end if;
end; $$;

create or replace function public.lata_reset_pin(target uuid) returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
declare ph text;
begin
  if not public.lata_is_admin() then raise exception 'Nur Admins'; end if;
  select phone into ph from public."lata-profiles" where id = target;
  if ph is null then raise exception 'Person nicht gefunden'; end if;
  update auth.users set encrypted_password = crypt(right(regexp_replace(ph, '\D', '', 'g'), 6), gen_salt('bf')) where id = target;
  update public."lata-profiles" set pin_changed = false where id = target;
  if to_regclass('public.profiles') is not null then
    execute 'update public.profiles set pin_changed = false where id = $1' using target;
  end if;
end; $$;

create or replace function public.lata_set_admin(target uuid, make_admin boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.lata_is_admin() then raise exception 'Nur Admins'; end if;
  if target = auth.uid() and not make_admin then raise exception 'Du kannst dir die Admin-Rechte nicht selbst entziehen'; end if;
  update public."lata-profiles" set is_admin = make_admin, is_guest = case when make_admin then false else is_guest end where id = target;
end; $$;

create or replace function public.lata_set_event_manager(target uuid, flag boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.lata_is_admin() then raise exception 'Nur Admins'; end if;
  update public."lata-profiles" set is_event_manager = flag, is_guest = case when flag then false else is_guest end where id = target;
end; $$;

create or replace function public.lata_set_guest(target uuid, flag boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.lata_is_admin() then raise exception 'Nur Admins'; end if;
  if flag and exists (select 1 from public."lata-profiles" where id = target and (is_admin or is_event_manager or phone = public.lata_default_admin_phone())) then
    raise exception 'GUEST_NOT_ALLOWED';
  end if;
  update public."lata-profiles" set is_guest = flag where id = target;
end; $$;

create or replace function public.lata_set_app_design(p_design text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.lata_is_admin() then raise exception 'Nur Admins'; end if;
  if p_design not in ('standard', 'holland', 'light', 'petrol') then raise exception 'Ungültiges Design'; end if;
  insert into public."lata-app_settings" (key, value) values ('design', p_design)
  on conflict (key) do update set value = excluded.value;
end; $$;

create or replace function public.lata_set_app_language(p_lang text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.lata_is_admin() then raise exception 'Nur Admins'; end if;
  if p_lang not in ('de', 'en', 'nl') then raise exception 'Ungültige Sprache'; end if;
  insert into public."lata-app_settings" (key, value) values ('language', p_lang)
  on conflict (key) do update set value = excluded.value;
end; $$;

create or replace function public.lata_run_recurring() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; due date; last_due date; n int := 0; tid uuid;
begin
  if not public.lata_is_user() then return 0; end if;
  for r in select * from public."lata-recurring_tasks" where active and next_due <= current_date for update loop
    due := r.next_due; last_due := null;
    while due <= current_date loop
      last_due := due;
      due := public.lata_advance_due(r.freq, r.weekday, r.month_day, due);
    end loop;
    insert into public."lata-tasks" (title, note, created_by, due_date) values (r.title, r.note, r.created_by, last_due) returning id into tid;
    insert into public."lata-task_assignees" (task_id, user_id) values (tid, r.assigned_to);   -- die zugewiesene Person wird Favorit
    update public."lata-recurring_tasks" set next_due = due where id = r.id;
    n := n + 1;
  end loop;
  return n;
end; $$;

-- ===== Einkauf: Produkte und Wünsche =====
-- Produkt (falls neu) anlegen und für die gewählten Personen (Standard: ich) zum Favoriten machen (nicht angetickt). Gibt die Produkt-ID zurück.
create or replace function public.lata_add_wish(p_name text, p_note text, p_list uuid, p_users uuid[]) returns uuid
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); nm text := btrim(coalesce(p_name, '')); pid uuid; u uuid; users uuid[]; pub boolean;
begin
  if not public.lata_is_user() then raise exception 'Nicht angemeldet'; end if;
  if char_length(nm) not between 1 and 80 then raise exception 'Name fehlt'; end if;
  if not public.lata_can_see_list(p_list) then raise exception 'NEED_FORBIDDEN'; end if;
  pub := p_list is null or exists (select 1 from public."lata-shop_lists" where id = p_list and not is_private);
  select id into pid from public."lata-products" where lower(btrim(name)) = lower(nm);
  if pid is null then
    insert into public."lata-products" (name, created_by) values (nm, me) on conflict (lower(btrim(name))) do nothing returning id into pid;
    if pid is null then select id into pid from public."lata-products" where lower(btrim(name)) = lower(nm); end if;
  end if;
  users := case when p_users is null then array[me] else p_users end;   -- NULL = ich; leeres Array = nur das Produkt anlegen, kein Favorit
  foreach u in array users loop
    if not exists (select 1 from public."lata-profiles" where id = u) then raise exception 'Person nicht gefunden'; end if;
    insert into public."lata-wishes" (product_id, user_id, created_by, note, list_id, selected)
    values (pid, u, me, nullif(btrim(coalesce(p_note, '')), ''), case when u = me or pub then p_list end, false)
    on conflict (product_id, user_id) do nothing;
  end loop;
  return pid;
end; $$;

-- Einkaufsliste aktualisieren: gekaufte Produkte gehen zurück zu den Favoriten (nie gelöscht)
create or replace function public.lata_list_update(p_list uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.lata_is_user() or p_list is null or not public.lata_can_see_list(p_list) then raise exception 'NEED_FORBIDDEN'; end if;
  update public."lata-wishes" set selected = false, checked = false where list_id = p_list and selected and checked;
  get diagnostics n = row_count;
  return n;
end; $$;

-- ===== RLS =====
alter table public."lata-app_settings"     enable row level security;  -- bewusst ohne Policy: Zugriff nur über Funktionen
alter table public."lata-profiles"         enable row level security;
alter table public."lata-events"           enable row level security;
alter table public."lata-event_assignees"  enable row level security;
alter table public."lata-event_responses"  enable row level security;
alter table public."lata-tasks"            enable row level security;
alter table public."lata-task_assignees"   enable row level security;
alter table public."lata-recurring_tasks"  enable row level security;
alter table public."lata-shop_lists"       enable row level security;
alter table public."lata-products"         enable row level security;
alter table public."lata-wishes"           enable row level security;

do $$ declare r record; begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname = 'public' and tablename like 'lata-%' loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

create policy profiles_select     on public."lata-profiles" for select to authenticated using (public.lata_is_user());
create policy profiles_update_own on public."lata-profiles" for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy events_select on public."lata-events" for select to authenticated using (public.lata_is_user());
create policy events_manage on public."lata-events" for all to authenticated using (public.lata_can_manage_events()) with check (public.lata_can_manage_events());
create policy event_assignees_select on public."lata-event_assignees" for select to authenticated using (public.lata_is_user());
create policy event_assignees_manage on public."lata-event_assignees" for all to authenticated using (public.lata_can_manage_events()) with check (public.lata_can_manage_events());
-- Favorit eines Events: jede Person setzt und entfernt ihren eigenen Eintrag (Stern in der Agenda)
create policy event_assignees_add_any on public."lata-event_assignees" for insert to authenticated with check (public.lata_is_user());   -- «Favorit für»: andere hinzufügen
create policy event_assignees_own_write on public."lata-event_assignees" for all to authenticated
  using (user_id = auth.uid() and public.lata_is_user()) with check (user_id = auth.uid() and public.lata_is_user());
create policy event_responses_select on public."lata-event_responses" for select to authenticated using (public.lata_is_user());
create policy event_responses_own_write on public."lata-event_responses" for all to authenticated
  using (user_id = auth.uid() and public.lata_is_user()) with check (user_id = auth.uid() and public.lata_is_user());

-- Tasks sind für alle sichtbar; ändern: Ersteller/in und Admins; erledigen zusätzlich die zugeteilten Personen
create policy tasks_select on public."lata-tasks" for select to authenticated using (public.lata_is_user());
create policy tasks_insert on public."lata-tasks" for insert to authenticated with check (public.lata_is_user() and created_by = auth.uid());
create policy tasks_update on public."lata-tasks" for update to authenticated
  using (public.lata_is_user() and (created_by = auth.uid() or public.lata_is_task_assignee(id) or public.lata_is_admin()))
  with check (public.lata_is_user() and (created_by = auth.uid() or public.lata_is_task_assignee(id) or public.lata_is_admin()));
create policy tasks_delete on public."lata-tasks" for delete to authenticated using (created_by = auth.uid() or public.lata_is_admin());
create policy task_assignees_select on public."lata-task_assignees" for select to authenticated using (public.lata_is_user());
create policy task_assignees_add_any on public."lata-task_assignees" for insert to authenticated with check (public.lata_is_user());   -- «Favorit für»: andere hinzufügen
create policy task_assignees_own_write on public."lata-task_assignees" for all to authenticated   -- Stern: eigener Eintrag
  using (user_id = auth.uid() and public.lata_is_user()) with check (user_id = auth.uid() and public.lata_is_user());
create policy task_assignees_manage on public."lata-task_assignees" for all to authenticated      -- «Favorit für»: Ersteller/in und Admins
  using (public.lata_can_manage_task(task_id)) with check (public.lata_can_manage_task(task_id));

create policy recurring_admin on public."lata-recurring_tasks" for all to authenticated using (public.lata_is_admin()) with check (public.lata_is_admin());

create policy shop_lists_select on public."lata-shop_lists" for select to authenticated using (public.lata_is_user() and (not is_private or owner_id = auth.uid()));
create policy shop_lists_insert on public."lata-shop_lists" for insert to authenticated with check (public.lata_is_user() and owner_id = auth.uid());
create policy shop_lists_update on public."lata-shop_lists" for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy shop_lists_delete on public."lata-shop_lists" for delete to authenticated using (owner_id = auth.uid() or (public.lata_is_admin() and not is_private));

create policy products_select on public."lata-products" for select to authenticated using (public.lata_is_user());
create policy products_update on public."lata-products" for update to authenticated
  using (public.lata_is_user() and (created_by = auth.uid() or public.lata_is_admin())) with check (created_by = auth.uid() or public.lata_is_admin());
-- Produkte bleiben im Katalog, bis sie ausdrücklich gelöscht werden (wer sie angelegt hat, oder Admin)
create policy products_delete on public."lata-products" for delete to authenticated using (public.lata_is_user() and (created_by = auth.uid() or public.lata_is_admin()));
-- Anlegen von Produkten nur über lata_add_wish (keine insert-Policy)

create policy wishes_select on public."lata-wishes" for select to authenticated
  using (public.lata_is_user() and (user_id = auth.uid() or public.lata_can_see_list(list_id)));
create policy wishes_update on public."lata-wishes" for update to authenticated
  using (public.lata_is_user() and (user_id = auth.uid() or public.lata_can_see_list(list_id)))
  with check (public.lata_can_see_list(list_id));
create policy wishes_delete on public."lata-wishes" for delete to authenticated using (user_id = auth.uid());   -- Favorit entfernt nur die Person selbst
-- Anlegen von Wünschen nur über lata_add_wish (keine insert-Policy)

-- ===== Rechte =====
-- Nur lata-Tabellen anfassen (Vorlage-Tabellen nie). anon braucht keinen Tabellenzugriff.
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname = 'public' and tablename like 'lata-%' loop
    execute format('revoke all on public.%I from anon', t.tablename);
  end loop;
end $$;
-- lata-profiles: Clients dürfen nur diese Spalten ändern; Rollen nur per RPC
revoke update on public."lata-profiles" from authenticated;
grant update (name, language, theme, pin_changed, design) on public."lata-profiles" to authenticated;
revoke insert, delete on public."lata-profiles" from authenticated;
-- Produkte und Wünsche entstehen nur über die RPC lata_add_wish
revoke insert on public."lata-products", public."lata-wishes" from authenticated;

do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'lata\_%' loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
-- Vor dem Login nötig (Standard-Design/-Sprache auf dem Login-Bildschirm):
grant execute on function public.lata_app_design(), public.lata_app_language() to anon;

-- ===== Realtime =====
do $$ declare t text; begin
  foreach t in array array['lata-profiles','lata-events','lata-event_assignees','lata-event_responses','lata-tasks',
                           'lata-recurring_tasks','lata-shop_lists','lata-products','lata-wishes','lata-task_assignees'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ===== Default-Admin (Standard-PIN 232345 – beim ersten Login ändern!) =====
select public.lata__create_user('System Administrator', '+41796232345', true);
