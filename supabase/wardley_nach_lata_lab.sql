-- Wardley-App im Projekt lata-lab (ofdkpdmcfqnelqoaeshx)
-- Alle Tabellen, Funktionen, Indizes, Trigger und Policies mit Präfix wardley_.
-- Idempotent: kann mehrfach im SQL-Editor von lata-lab ausgeführt werden.
-- Enthält keine Personendaten (die Daten werden separat kopiert).

-- ---------- Tabellen ----------
create table if not exists public.wardley_app_settings (
  key   text primary key,
  value text
);

create table if not exists public.wardley_profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null check (char_length(name) >= 1 and char_length(name) <= 40),
  is_admin   boolean not null default false,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  phone      text not null unique check (phone ~ '^\+[1-9][0-9]{7,14}$')
);

create table if not exists public.wardley_maps (
  id         uuid primary key default gen_random_uuid(),
  title      text not null default 'Neue Map',
  owner_id   uuid not null references public.wardley_profiles(id),
  data       jsonb not null default '{"links": [], "nodes": []}'::jsonb,
  rev        integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wardley_maps_owner_idx on public.wardley_maps (owner_id);

create table if not exists public.wardley_map_members (
  map_id  uuid not null references public.wardley_maps(id) on delete cascade,
  user_id uuid not null references public.wardley_profiles(id) on delete cascade,
  role    text not null check (role = any (array['editor','viewer'])),
  primary key (map_id, user_id)
);
create index if not exists wardley_map_members_user_idx on public.wardley_map_members (user_id);

create table if not exists public.wardley_map_versions (
  id         uuid primary key default gen_random_uuid(),
  map_id     uuid not null references public.wardley_maps(id) on delete cascade,
  label      text not null default '',
  data       jsonb not null,
  created_by uuid references public.wardley_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists wardley_map_versions_map_idx on public.wardley_map_versions (map_id, created_at desc);

alter table public.wardley_app_settings enable row level security;
alter table public.wardley_profiles     enable row level security;
alter table public.wardley_maps         enable row level security;
alter table public.wardley_map_members  enable row level security;
alter table public.wardley_map_versions enable row level security;

-- ---------- Funktionen ----------
create or replace function public.wardley_normalize_phone(p text)
returns text language plpgsql immutable set search_path to 'public' as $f$
declare
  s text := coalesce(p, '');
begin
  s := replace(s, '(0)', '');
  s := regexp_replace(s, '[^0-9+]', '', 'g');
  if s like '00%' then
    s := '+' || substr(s, 3);
  elsif s like '0%' then
    s := '+41' || substr(s, 2);
  elsif s ~ '^41[0-9]{9}$' then
    s := '+' || s;
  end if;
  if s !~ '^\+[1-9][0-9]{7,14}$' then return null; end if;
  if s like '+41%' and length(s) <> 12 then return null; end if;
  return s;
end $f$;

create or replace function public.wardley_is_active()
returns boolean language sql stable security definer set search_path to 'public' as $f$
  select coalesce((select p.active from public.wardley_profiles p where p.id = auth.uid()), false)
$f$;

create or replace function public.wardley_is_admin()
returns boolean language sql stable security definer set search_path to 'public' as $f$
  select coalesce((select p.is_admin and p.active from public.wardley_profiles p where p.id = auth.uid()), false)
$f$;

create or replace function public.wardley_map_role(p_map uuid)
returns text language sql stable security definer set search_path to 'public' as $f$
  select case
    when not public.wardley_is_active() then null
    when public.wardley_is_admin() then 'admin'
    when m.owner_id = auth.uid() then 'owner'
    else (select mm.role from public.wardley_map_members mm where mm.map_id = m.id and mm.user_id = auth.uid())
  end
  from public.wardley_maps m where m.id = p_map
$f$;

create or replace function public.wardley_can_read(p_map uuid)
returns boolean language sql stable security definer set search_path to 'public' as $f$
  select public.wardley_map_role(p_map) is not null
$f$;

create or replace function public.wardley_can_edit(p_map uuid)
returns boolean language sql stable security definer set search_path to 'public' as $f$
  select coalesce(public.wardley_map_role(p_map) in ('admin', 'owner', 'editor'), false)
$f$;

create or replace function public.wardley_can_manage(p_map uuid)
returns boolean language sql stable security definer set search_path to 'public' as $f$
  select coalesce(public.wardley_map_role(p_map) in ('admin', 'owner'), false)
$f$;

create or replace function public.wardley_maps_guard()
returns trigger language plpgsql security definer set search_path to 'public' as $f$
begin
  if jsonb_typeof(new.data -> 'nodes') is distinct from 'array'
     or jsonb_typeof(new.data -> 'links') is distinct from 'array' then
    raise exception 'Ungültige Map-Daten';
  end if;
  if pg_column_size(new.data) > 2000000 then
    raise exception 'Map zu gross';
  end if;
  new.title := left(btrim(new.title), 100);
  if new.title = '' then new.title := 'Neue Map'; end if;
  if tg_op = 'UPDATE' then
    if new.owner_id <> old.owner_id and not public.wardley_can_manage(old.id) then
      raise exception 'Besitzer nicht änderbar';
    end if;
    new.id := old.id;
    new.created_at := old.created_at;
    new.rev := old.rev + 1;
    new.updated_at := now();
  end if;
  return new;
end $f$;

create or replace function public.wardley_members_guard()
returns trigger language plpgsql security definer set search_path to 'public' as $f$
begin
  if new.user_id = (select m.owner_id from public.wardley_maps m where m.id = new.map_id) then
    raise exception 'Besitzer braucht keine Mitgliedschaft';
  end if;
  return new;
end $f$;

create or replace function public.wardley_versions_prune()
returns trigger language plpgsql security definer set search_path to 'public' as $f$
begin
  delete from public.wardley_map_versions v
   where v.map_id = new.map_id
     and v.id in (
       select id from public.wardley_map_versions
        where map_id = new.map_id
        order by created_at desc offset 50
     );
  return null;
end $f$;

create or replace function public.wardley__create_user(p_name text, p_phone text, p_pin text, p_is_admin boolean)
returns uuid language plpgsql security definer set search_path to 'public', 'extensions' as $f$
declare
  v_id     uuid := gen_random_uuid();
  v_name   text := btrim(coalesce(p_name, ''));
  v_phone  text := public.wardley_normalize_phone(p_phone);
  v_pin    text;
  v_domain text;
  v_email  text;
begin
  if v_name = '' or char_length(v_name) > 40 then
    raise exception 'Name ungültig';
  end if;
  if v_phone is null then
    raise exception 'Mobilnummer ungültig';
  end if;
  v_pin := coalesce(nullif(btrim(coalesce(p_pin, '')), ''), right(regexp_replace(v_phone, '[^0-9]', '', 'g'), 6));
  if v_pin !~ '^[0-9]{6}$' then
    raise exception 'PIN: 6 Ziffern';
  end if;
  if exists (select 1 from public.wardley_profiles where phone = v_phone) then
    raise exception 'Mobilnummer ist bereits registriert';
  end if;
  select value into v_domain from public.wardley_app_settings where key = 'email_domain';
  v_email := ltrim(v_phone, '+') || '@' || coalesce(v_domain, 'wardley.app');

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, reauthentication_token, phone_change, phone_change_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    crypt(v_pin, gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now(),
    '', '', '', '', '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  insert into public.wardley_profiles (id, name, phone, is_admin)
  values (v_id, v_name, v_phone, coalesce(p_is_admin, false));

  return v_id;
end $f$;

create or replace function public.wardley_admin_list_users()
returns table(id uuid, name text, phone text, is_admin boolean, active boolean, created_at timestamptz)
language plpgsql security definer set search_path to 'public' as $f$
begin
  if not public.wardley_is_admin() then raise exception 'Nur für Admins'; end if;
  return query
    select p.id, p.name, p.phone, p.is_admin, p.active, p.created_at
      from public.wardley_profiles p order by lower(p.name);
end $f$;

create or replace function public.wardley_admin_create_user(p_name text, p_phone text, p_pin text default null, p_is_admin boolean default false)
returns uuid language plpgsql security definer set search_path to 'public', 'extensions' as $f$
begin
  if not public.wardley_is_admin() then raise exception 'Nur für Admins'; end if;
  return public.wardley__create_user(p_name, p_phone, p_pin, p_is_admin);
end $f$;

create or replace function public.wardley_admin_set_user_flags(p_user uuid, p_is_admin boolean, p_active boolean)
returns void language plpgsql security definer set search_path to 'public', 'extensions' as $f$
begin
  if not public.wardley_is_admin() then raise exception 'Nur für Admins'; end if;
  if p_user = auth.uid() and (not p_is_admin or not p_active) then
    raise exception 'Eigene Rechte nicht entziehbar';
  end if;
  update public.wardley_profiles set is_admin = p_is_admin, active = p_active where id = p_user;
  if not found then raise exception 'Benutzer nicht gefunden'; end if;
  update auth.users
     set banned_until = case when p_active then null else 'infinity'::timestamptz end
   where id = p_user;
  if not exists (select 1 from public.wardley_profiles where is_admin and active) then
    raise exception 'Mindestens ein aktiver Admin nötig';
  end if;
end $f$;

create or replace function public.wardley_admin_reset_pin(p_user uuid, p_pin text default null)
returns void language plpgsql security definer set search_path to 'public', 'extensions' as $f$
declare
  v_phone text;
  v_pin   text;
begin
  if not public.wardley_is_admin() then raise exception 'Nur für Admins'; end if;
  select phone into v_phone from public.wardley_profiles where id = p_user;
  if v_phone is null then raise exception 'Benutzer nicht gefunden'; end if;
  v_pin := coalesce(nullif(btrim(coalesce(p_pin, '')), ''), right(regexp_replace(v_phone, '[^0-9]', '', 'g'), 6));
  if v_pin !~ '^[0-9]{6}$' then raise exception 'PIN: 6 Ziffern'; end if;
  update auth.users set encrypted_password = crypt(v_pin, gen_salt('bf')), updated_at = now()
   where id = p_user;
end $f$;

create or replace function public.wardley_admin_delete_user(p_user uuid)
returns void language plpgsql security definer set search_path to 'public', 'extensions' as $f$
begin
  if not public.wardley_is_admin() then raise exception 'Nur für Admins'; end if;
  if p_user = auth.uid() then raise exception 'Eigenes Konto nicht löschbar'; end if;
  if not exists (select 1 from public.wardley_profiles where id = p_user) then
    raise exception 'Benutzer nicht gefunden';
  end if;
  update public.wardley_maps set owner_id = auth.uid() where owner_id = p_user;
  delete from auth.users where id = p_user;
  if not exists (select 1 from public.wardley_profiles where is_admin and active) then
    raise exception 'Mindestens ein aktiver Admin nötig';
  end if;
end $f$;

create or replace function public.wardley_set_map_members(p_map uuid, p_members jsonb)
returns void language plpgsql security definer set search_path to 'public' as $f$
declare
  k text;
  v text;
begin
  if not public.wardley_can_manage(p_map) then raise exception 'Nur Besitzer oder Admin'; end if;
  delete from public.wardley_map_members where map_id = p_map;
  for k, v in select * from jsonb_each_text(coalesce(p_members, '{}'::jsonb)) loop
    continue when v not in ('editor', 'viewer')
      or k !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
    insert into public.wardley_map_members (map_id, user_id, role)
    select p_map, k::uuid, v
     where exists (select 1 from public.wardley_profiles p where p.id = k::uuid)
       and k::uuid <> (select m.owner_id from public.wardley_maps m where m.id = p_map)
    on conflict (map_id, user_id) do update set role = excluded.role;
  end loop;
end $f$;

-- ---------- Trigger ----------
drop trigger if exists wardley_maps_guard_trg on public.wardley_maps;
create trigger wardley_maps_guard_trg before insert or update on public.wardley_maps
  for each row execute function public.wardley_maps_guard();
drop trigger if exists wardley_members_guard_trg on public.wardley_map_members;
create trigger wardley_members_guard_trg before insert or update on public.wardley_map_members
  for each row execute function public.wardley_members_guard();
drop trigger if exists wardley_versions_prune_trg on public.wardley_map_versions;
create trigger wardley_versions_prune_trg after insert on public.wardley_map_versions
  for each row execute function public.wardley_versions_prune();

-- ---------- Policies ----------
drop policy if exists wardley_profiles_select on public.wardley_profiles;
create policy wardley_profiles_select on public.wardley_profiles for select to authenticated
  using (public.wardley_is_active());
drop policy if exists wardley_maps_select on public.wardley_maps;
create policy wardley_maps_select on public.wardley_maps for select to authenticated
  using (((owner_id = auth.uid()) and public.wardley_is_active()) or public.wardley_can_read(id));
drop policy if exists wardley_maps_insert on public.wardley_maps;
create policy wardley_maps_insert on public.wardley_maps for insert to authenticated
  with check ((owner_id = auth.uid()) and public.wardley_is_active());
drop policy if exists wardley_maps_update on public.wardley_maps;
create policy wardley_maps_update on public.wardley_maps for update to authenticated
  using (public.wardley_can_edit(id)) with check (public.wardley_can_edit(id));
drop policy if exists wardley_maps_delete on public.wardley_maps;
create policy wardley_maps_delete on public.wardley_maps for delete to authenticated
  using (public.wardley_can_manage(id));
drop policy if exists wardley_members_select on public.wardley_map_members;
create policy wardley_members_select on public.wardley_map_members for select to authenticated
  using (public.wardley_can_read(map_id));
drop policy if exists wardley_members_write on public.wardley_map_members;
create policy wardley_members_write on public.wardley_map_members for all to authenticated
  using (public.wardley_can_manage(map_id)) with check (public.wardley_can_manage(map_id));
drop policy if exists wardley_versions_select on public.wardley_map_versions;
create policy wardley_versions_select on public.wardley_map_versions for select to authenticated
  using (public.wardley_can_read(map_id));
drop policy if exists wardley_versions_insert on public.wardley_map_versions;
create policy wardley_versions_insert on public.wardley_map_versions for insert to authenticated
  with check (public.wardley_can_edit(map_id) and (created_by = auth.uid()));
drop policy if exists wardley_versions_delete on public.wardley_map_versions;
create policy wardley_versions_delete on public.wardley_map_versions for delete to authenticated
  using (public.wardley_can_manage(map_id));

-- ---------- Rechte (wie im Quellprojekt) ----------
revoke all on public.wardley_app_settings, public.wardley_profiles from anon, authenticated;
revoke all on public.wardley_maps, public.wardley_map_members, public.wardley_map_versions from anon, authenticated;
grant select, insert, update, delete on public.wardley_maps, public.wardley_map_members, public.wardley_map_versions to authenticated;

do $g$
declare f text;
begin
  for f in
    select p.oid::regprocedure::text from pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.proname like 'wardley\_%'
  loop
    execute 'revoke all on function ' || f || ' from public, anon';
    if f like 'wardley\_\_create\_user%' then
      execute 'revoke all on function ' || f || ' from authenticated';
    else
      execute 'grant execute on function ' || f || ' to authenticated';
    end if;
  end loop;
end $g$;
