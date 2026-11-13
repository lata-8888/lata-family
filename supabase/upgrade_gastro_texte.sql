-- Intro- und Outro-Text je Gastronomie (für die WhatsApp-Bestellung: Intro, Einkaufsliste, Outro).
-- Lesen: alle (Policy gastros_select); ändern nur Admins und Food Manager per lata_set_gastro_texts.
alter table public."lata-gastros" add column if not exists intro text not null default '' check (char_length(intro) <= 1000);
alter table public."lata-gastros" add column if not exists outro text not null default '' check (char_length(outro) <= 1000);

create or replace function public.lata_set_gastro_texts(p_key text, p_intro text, p_outro text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.lata_can_manage_gastro() then raise exception 'Nur Admins und Food Manager'; end if;
  if char_length(coalesce(p_intro, '')) > 1000 or char_length(coalesce(p_outro, '')) > 1000 then raise exception 'Text zu lang (max. 1000 Zeichen)'; end if;
  update public."lata-gastros" set intro = btrim(coalesce(p_intro, '')), outro = btrim(coalesce(p_outro, '')) where key = p_key;
  if not found then raise exception 'Unbekannte Gastronomie'; end if;
end; $$;
revoke all on function public.lata_set_gastro_texts(text, text, text) from public, anon;
grant execute on function public.lata_set_gastro_texts(text, text, text) to authenticated;
