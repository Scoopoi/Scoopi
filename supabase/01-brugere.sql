-- Karpeloggen – trin 1: brugere og godkendelse
-- Kør hele filen én gang i Supabase: SQL Editor → New query → indsæt → Run.
--
-- Sådan virker det:
--  * Man opretter sig med brugernavn + adgangskode og får status 'afventer'.
--  * Brugeren med brugernavnet 'Scoopi' bliver automatisk administrator (kun hvis der ikke er en i forvejen).
--  * Administratoren godkender og får en kode, som sendes til vennen.
--  * Vennen taster koden og bliver 'godkendt'. Kun godkendte kan se gruppens data.
--  * Reglerne håndhæves i databasen (Row Level Security), ikke kun i appen.

create table if not exists public.profiler (
  id uuid primary key references auth.users (id) on delete cascade,
  brugernavn text not null unique check (char_length(brugernavn) between 2 and 30),
  status text not null default 'afventer' check (status in ('afventer', 'godkendt', 'afvist')),
  rolle text not null default 'medlem' check (rolle in ('medlem', 'admin')),
  oprettet timestamptz not null default now()
);

create table if not exists public.koder (
  bruger_id uuid primary key references public.profiler (id) on delete cascade,
  kode text not null,
  oprettet timestamptz not null default now()
);

alter table public.profiler enable row level security;
alter table public.koder enable row level security;

-- Hjælpefunktioner (security definer, så de kan læse profiler uden at ramme reglerne selv)
create or replace function public.er_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiler where id = auth.uid() and rolle = 'admin' and status = 'godkendt');
$$;

create or replace function public.er_godkendt() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiler where id = auth.uid() and status = 'godkendt');
$$;

-- Nye profiler: altid 'afventer'/'medlem' – undtagen den allerførste, som bliver administrator.
create or replace function public.ny_profil() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Kun brugernavnet 'Scoopi' kan blive administrator (og kun hvis der ikke er en i forvejen)
  if not exists (select 1 from profiler where rolle = 'admin') and lower(new.brugernavn) = 'scoopi' then
    new.rolle := 'admin';
    new.status := 'godkendt';
  else
    new.rolle := 'medlem';
    new.status := 'afventer';
  end if;
  new.oprettet := now();
  return new;
end $$;

drop trigger if exists ny_profil on public.profiler;
create trigger ny_profil before insert on public.profiler
for each row execute function public.ny_profil();

-- Regler for profiler
drop policy if exists "se profiler" on public.profiler;
create policy "se profiler" on public.profiler for select to authenticated
  using (id = auth.uid() or public.er_godkendt());

drop policy if exists "opret egen profil" on public.profiler;
create policy "opret egen profil" on public.profiler for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "admin retter profiler" on public.profiler;
create policy "admin retter profiler" on public.profiler for update to authenticated
  using (public.er_admin()) with check (public.er_admin());

drop policy if exists "admin sletter profiler" on public.profiler;
create policy "admin sletter profiler" on public.profiler for delete to authenticated
  using (public.er_admin() and id <> auth.uid());

-- Koder kan kun ses af administratoren
drop policy if exists "admin ser koder" on public.koder;
create policy "admin ser koder" on public.koder for select to authenticated
  using (public.er_admin());

-- Godkend: laver en kode til brugeren (kun administrator)
create or replace function public.godkend(bruger uuid) returns text
language plpgsql security definer set search_path = public as $$
declare k text;
begin
  if not public.er_admin() then raise exception 'Kun administratoren kan godkende'; end if;
  if not exists (select 1 from profiler where id = bruger) then raise exception 'Ukendt bruger'; end if;
  k := 'KARPE-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4))
              || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
  insert into koder (bruger_id, kode) values (bruger, k)
    on conflict (bruger_id) do update set kode = excluded.kode, oprettet = now();
  update profiler set status = 'afventer' where id = bruger and status = 'afvist';
  return k;
end $$;

-- Brug kode: den ventende bruger taster koden fra administratoren
create or replace function public.brug_kode(kode_ind text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from koder where bruger_id = auth.uid() and upper(kode) = upper(trim(kode_ind))) then
    update profiler set status = 'godkendt' where id = auth.uid();
    delete from koder where bruger_id = auth.uid();
    return true;
  end if;
  return false;
end $$;

-- Afvis / fjern adgang (kun administrator; man kan ikke fjerne sig selv)
create or replace function public.afvis(bruger uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.er_admin() then raise exception 'Kun administratoren kan afvise'; end if;
  if bruger = auth.uid() then raise exception 'Du kan ikke fjerne dig selv'; end if;
  update profiler set status = 'afvist' where id = bruger;
  delete from koder where bruger_id = bruger;
end $$;

revoke all on function public.godkend(uuid), public.brug_kode(text), public.afvis(uuid) from public, anon;
grant execute on function public.godkend(uuid), public.brug_kode(text), public.afvis(uuid), public.er_admin(), public.er_godkendt() to authenticated;
grant select, insert, update, delete on public.profiler to authenticated;
grant select on public.koder to authenticated;
