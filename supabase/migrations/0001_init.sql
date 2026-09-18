-- ============================================================================
--  Team Picker — schema, row level security and RPCs
--  Run this once against a fresh Supabase project (SQL Editor, or
--  `supabase db push` if you use the CLI). Safe to re-run.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

-- The six teams are fixed. They are seeded by supabase/seed.sql and are not
-- creatable or deletable from the app; only `roster_size` is editable (admin).
create table if not exists public.teams (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  display_name text not null,
  color_hex    text not null,
  text_hex     text not null,
  roster_size  int  not null default 9 check (roster_size between 5 and 20),
  sort_order   int  not null
);

-- One row per auth user. `email` is mirrored here so the admin Access screen
-- can list captains without needing the service-role key.
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  full_name  text,
  role       text not null default 'captain' check (role in ('admin', 'captain')),
  team_id    uuid references public.teams (id) on delete set null,
  can_edit   boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id            uuid primary key default gen_random_uuid(),
  team_id       uuid not null references public.teams (id) on delete cascade,
  position      int  not null check (position >= 1),
  name          text not null check (btrim(name) <> ''),
  xaalada       text not null default '',
  joogtaynta    text not null default '',
  heerka_kubada text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- Deferrable so reorder_players() can shuffle positions inside one
  -- transaction without tripping over itself mid-update.
  constraint players_team_position_key unique (team_id, position)
    deferrable initially deferred
);

create index if not exists players_team_position_idx
  on public.players (team_id, position);

create index if not exists profiles_team_idx on public.profiles (team_id);

-- Keep updated_at honest.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists players_touch_updated_at on public.players;
create trigger players_touch_updated_at
  before update on public.players
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Permission helpers
--
-- These are SECURITY DEFINER so that policies on `players` can read `profiles`
-- without recursing through that table's own RLS policies.
-- ----------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- True when the current user may write to the given team:
--   * admins, always
--   * the captain of that team, but only while the admin has set can_edit
create or replace function public.can_edit_team(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'admin'
        or (p.role = 'captain' and p.can_edit and p.team_id = p_team_id)
      )
  );
$$;

-- ----------------------------------------------------------------------------
-- Row level security
-- ----------------------------------------------------------------------------

alter table public.teams    enable row level security;
alter table public.profiles enable row level security;
alter table public.players  enable row level security;

-- teams ----------------------------------------------------------------------
drop policy if exists teams_select on public.teams;
create policy teams_select on public.teams
  for select to authenticated
  using (true);

-- Only the admin may change roster_size. No insert/delete policy exists at all,
-- so the six teams cannot be created or removed from the client.
drop policy if exists teams_update_admin on public.teams;
create policy teams_update_admin on public.teams
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- profiles -------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- Captains may edit their own display name and nothing else; the WITH CHECK
-- pins role / team_id / can_edit to their existing values.
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role     = (select p.role     from public.profiles p where p.id = auth.uid())
    and can_edit = (select p.can_edit from public.profiles p where p.id = auth.uid())
    and team_id  is not distinct from
        (select p.team_id from public.profiles p where p.id = auth.uid())
  );

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- players --------------------------------------------------------------------
-- Everyone signed in can read every roster (captains can scout the other side).
drop policy if exists players_select on public.players;
create policy players_select on public.players
  for select to authenticated
  using (true);

drop policy if exists players_insert on public.players;
create policy players_insert on public.players
  for insert to authenticated
  with check (public.can_edit_team(team_id));

drop policy if exists players_update on public.players;
create policy players_update on public.players
  for update to authenticated
  using (public.can_edit_team(team_id))
  with check (public.can_edit_team(team_id));

drop policy if exists players_delete on public.players;
create policy players_delete on public.players
  for delete to authenticated
  using (public.can_edit_team(team_id));

-- ----------------------------------------------------------------------------
-- RPCs
--
-- Adding, deleting and reordering all have to keep positions contiguous 1..n
-- (position 1 is the captain), so they run server-side in one transaction
-- instead of as a sequence of client writes. Each re-checks permission itself
-- because SECURITY DEFINER bypasses RLS.
-- ----------------------------------------------------------------------------

-- Append a player at the next free position, enforcing the roster limit.
create or replace function public.add_player(
  p_team_id       uuid,
  p_name          text,
  p_xaalada       text default '',
  p_joogtaynta    text default '',
  p_heerka_kubada text default ''
)
returns public.players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_size int;
  v_next int;
  v_row  public.players;
begin
  if not public.can_edit_team(p_team_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if coalesce(btrim(p_name), '') = '' then
    raise exception 'name_required' using errcode = '23514';
  end if;

  select roster_size into v_size from public.teams where id = p_team_id;
  if v_size is null then
    raise exception 'team_not_found' using errcode = 'P0002';
  end if;

  select coalesce(max(position), 0) + 1 into v_next
  from public.players where team_id = p_team_id;

  if v_next > v_size then
    raise exception 'roster_full' using errcode = '23514';
  end if;

  insert into public.players (team_id, position, name, xaalada, joogtaynta, heerka_kubada)
  values (
    p_team_id,
    v_next,
    btrim(p_name),
    coalesce(p_xaalada, ''),
    coalesce(p_joogtaynta, ''),
    coalesce(p_heerka_kubada, '')
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- Delete a player and close the gap. Deleting position 1 therefore promotes
-- position 2 to captain.
create or replace function public.delete_player(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team uuid;
begin
  select team_id into v_team from public.players where id = p_id;
  if v_team is null then
    raise exception 'player_not_found' using errcode = 'P0002';
  end if;

  if not public.can_edit_team(v_team) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  delete from public.players where id = p_id;

  update public.players p
     set position = o.rn
    from (
      select id, row_number() over (order by position) as rn
      from public.players
      where team_id = v_team
    ) o
   where p.id = o.id
     and p.position <> o.rn;
end;
$$;

-- Renumber a whole team to the given order. `ordered_ids` must contain every
-- player on the team exactly once; anything else aborts the transaction and
-- leaves the roster untouched.
create or replace function public.reorder_players(p_team_id uuid, p_ordered_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count    int;
  v_expected int;
  i          int;
begin
  if not public.can_edit_team(p_team_id) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select count(*) into v_expected from public.players where team_id = p_team_id;

  select count(*) into v_count
  from (select distinct unnest(p_ordered_ids) as id) u
  join public.players pl on pl.id = u.id and pl.team_id = p_team_id;

  if v_count <> v_expected or coalesce(array_length(p_ordered_ids, 1), 0) <> v_expected then
    raise exception 'ordering_mismatch' using errcode = '23514';
  end if;

  -- The unique constraint is DEFERRABLE INITIALLY DEFERRED, so intermediate
  -- duplicate positions are fine until this function's transaction commits.
  for i in 1 .. v_expected loop
    update public.players
       set position = i
     where id = p_ordered_ids[i]
       and team_id = p_team_id;
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- Auto-create a profile whenever a user is added in the Supabase dashboard.
-- New users land as view-only captains with no team; the admin assigns them
-- on the Access screen.
-- ----------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, can_edit)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    'captain',
    false
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Grants. RLS still applies on top of these.
-- ----------------------------------------------------------------------------

grant usage on schema public to authenticated;
grant select on public.teams to authenticated;
grant update (roster_size) on public.teams to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.players to authenticated;

revoke all on function public.add_player(uuid, text, text, text, text) from public, anon;
revoke all on function public.delete_player(uuid) from public, anon;
revoke all on function public.reorder_players(uuid, uuid[]) from public, anon;

grant execute on function public.add_player(uuid, text, text, text, text) to authenticated;
grant execute on function public.delete_player(uuid) to authenticated;
grant execute on function public.reorder_players(uuid, uuid[]) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_edit_team(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- Realtime: let the app see roster changes made by other people live.
-- ----------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'players'
     )
  then
    alter publication supabase_realtime add table public.players;
  end if;
end
$$;
