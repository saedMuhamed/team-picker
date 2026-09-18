-- ============================================================================
--  Team Picker — waiting list, final teams, custom columns
--
--  Run after 0001_init.sql. Safe to re-run: every statement is idempotent.
--
--  It replaces can_edit_team() and the teams_update_admin policy from 0001,
--  so if you ever re-run 0001 you must re-run this file afterwards — otherwise
--  the finalized-team lock silently disappears.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Final teams
--
-- A finalized team is frozen: nobody may add, edit, delete or reorder its
-- players, and its roster_size is fixed. Only the admin can finalize, and only
-- the admin can lift it again. PDF export is gated on this flag.
-- ----------------------------------------------------------------------------

alter table public.teams
  add column if not exists is_final     boolean not null default false,
  add column if not exists finalized_at timestamptz,
  add column if not exists finalized_by uuid references auth.users (id) on delete set null;

-- ----------------------------------------------------------------------------
-- Custom columns
--
-- One global set, shared by every roster and the waiting list. `key` is
-- generated once and never changes, so renaming a column is a label-only edit
-- and the stored values follow along untouched.
-- ----------------------------------------------------------------------------

create table if not exists public.custom_columns (
  id         uuid primary key default gen_random_uuid(),
  key        text not null unique,
  label      text not null check (btrim(label) <> ''),
  sort_order int  not null,
  created_at timestamptz not null default now()
);

create index if not exists custom_columns_order_idx
  on public.custom_columns (sort_order);

-- Values live in a jsonb bag keyed by custom_columns.key, so adding a column
-- is a metadata insert rather than a schema change on a table under RLS.
alter table public.players
  add column if not exists custom jsonb not null default '{}'::jsonb;

-- ----------------------------------------------------------------------------
-- Waiting list
--
-- One global pool of players not yet on a final team. The admin assigns an
-- entry to a team with promote_waiting_player(), which moves it onto that
-- roster and removes it from the pool.
-- ----------------------------------------------------------------------------

create table if not exists public.waiting_list (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (btrim(name) <> ''),
  playing_position text not null default '',
  level            text not null default 'beginner'
                     check (level in ('beginner', 'intermediate', 'advanced', 'pro')),
  payment_status   text not null default 'unpaid'
                     check (payment_status in ('paid', 'pending', 'unpaid')),
  amount           numeric(10, 2) check (amount is null or amount >= 0),
  custom           jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists waiting_list_created_idx
  on public.waiting_list (created_at);

drop trigger if exists waiting_list_touch_updated_at on public.waiting_list;
create trigger waiting_list_touch_updated_at
  before update on public.waiting_list
  for each row execute function public.touch_updated_at();

-- ----------------------------------------------------------------------------
-- Permission helper — now also refuses a finalized team
--
-- Every roster write path (policies plus the add/delete/reorder RPCs) already
-- goes through this one function, so the lock lands everywhere at once.
-- ----------------------------------------------------------------------------

create or replace function public.can_edit_team(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
      select 1 from public.teams t
      where t.id = p_team_id and not t.is_final
    )
    and exists (
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

alter table public.custom_columns enable row level security;
alter table public.waiting_list   enable row level security;

-- Anyone signed in reads the column definitions; all writes go through the
-- admin-only RPCs below, so there is deliberately no write policy here.
drop policy if exists custom_columns_select on public.custom_columns;
create policy custom_columns_select on public.custom_columns
  for select to authenticated
  using (true);

-- The waiting list is club-level: everyone signed in can see who is waiting,
-- only the admin can change it.
drop policy if exists waiting_list_select on public.waiting_list;
create policy waiting_list_select on public.waiting_list
  for select to authenticated
  using (true);

drop policy if exists waiting_list_insert on public.waiting_list;
create policy waiting_list_insert on public.waiting_list
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists waiting_list_update on public.waiting_list;
create policy waiting_list_update on public.waiting_list
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists waiting_list_delete on public.waiting_list;
create policy waiting_list_delete on public.waiting_list
  for delete to authenticated
  using (public.is_admin());

-- roster_size is admin-only and now frozen once the team is final.
-- finalize_team()/unfinalize_team() are SECURITY DEFINER, so they still pass.
drop policy if exists teams_update_admin on public.teams;
create policy teams_update_admin on public.teams
  for update to authenticated
  using (public.is_admin() and not is_final)
  with check (public.is_admin());

-- ----------------------------------------------------------------------------
-- RPCs — finalizing
-- ----------------------------------------------------------------------------

create or replace function public.finalize_team(p_team_id uuid)
returns public.teams
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row   public.teams;
  v_count int;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select count(*) into v_count from public.players where team_id = p_team_id;
  if v_count = 0 then
    raise exception 'roster_empty' using errcode = '23514';
  end if;

  update public.teams
     set is_final = true, finalized_at = now(), finalized_by = auth.uid()
   where id = p_team_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'team_not_found' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

create or replace function public.unfinalize_team(p_team_id uuid)
returns public.teams
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.teams;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  update public.teams
     set is_final = false, finalized_at = null, finalized_by = null
   where id = p_team_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'team_not_found' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPCs — custom columns
--
-- Admin only. Deleting a column also strips its key out of every stored value
-- bag, so nothing is left behind to resurface if a later column is given the
-- same name.
-- ----------------------------------------------------------------------------

create or replace function public.add_custom_column(p_label text)
returns public.custom_columns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text := btrim(coalesce(p_label, ''));
  v_base  text;
  v_key   text;
  v_n     int := 1;
  v_row   public.custom_columns;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_label = '' then
    raise exception 'label_required' using errcode = '23514';
  end if;

  -- A stable snake_case key derived from the first label. It never changes
  -- afterwards, which is what makes renaming free.
  v_base := regexp_replace(lower(v_label), '[^a-z0-9]+', '_', 'g');
  v_base := btrim(v_base, '_');
  if v_base = '' then
    v_base := 'column';
  end if;
  v_base := left(v_base, 40);

  v_key := v_base;
  while exists (select 1 from public.custom_columns where key = v_key) loop
    v_n := v_n + 1;
    v_key := v_base || '_' || v_n;
  end loop;

  insert into public.custom_columns (key, label, sort_order)
  values (
    v_key,
    v_label,
    coalesce((select max(sort_order) from public.custom_columns), 0) + 1
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.rename_custom_column(p_id uuid, p_label text)
returns public.custom_columns
language plpgsql
security definer
set search_path = public
as $$
declare
  v_label text := btrim(coalesce(p_label, ''));
  v_row   public.custom_columns;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_label = '' then
    raise exception 'label_required' using errcode = '23514';
  end if;

  update public.custom_columns set label = v_label where id = p_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'column_not_found' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

create or replace function public.delete_custom_column(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select key into v_key from public.custom_columns where id = p_id;
  if v_key is null then
    raise exception 'column_not_found' using errcode = 'P0002';
  end if;

  delete from public.custom_columns where id = p_id;

  update public.players      set custom = custom - v_key where custom ? v_key;
  update public.waiting_list set custom = custom - v_key where custom ? v_key;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPCs — writing one custom value
--
-- Two functions rather than one taking a table name: each carries its own
-- permission rule, and neither builds SQL out of client input.
-- ----------------------------------------------------------------------------

create or replace function public.set_player_custom(
  p_player_id uuid,
  p_key       text,
  p_value     text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team uuid;
begin
  select team_id into v_team from public.players where id = p_player_id;
  if v_team is null then
    raise exception 'player_not_found' using errcode = 'P0002';
  end if;

  if not public.can_edit_team(v_team) then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if not exists (select 1 from public.custom_columns where key = p_key) then
    raise exception 'column_not_found' using errcode = 'P0002';
  end if;

  update public.players
     set custom = custom || jsonb_build_object(p_key, coalesce(p_value, ''))
   where id = p_player_id;
end;
$$;

create or replace function public.set_waiting_custom(
  p_waiting_id uuid,
  p_key        text,
  p_value      text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if not exists (select 1 from public.waiting_list where id = p_waiting_id) then
    raise exception 'waiting_not_found' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.custom_columns where key = p_key) then
    raise exception 'column_not_found' using errcode = 'P0002';
  end if;

  update public.waiting_list
     set custom = custom || jsonb_build_object(p_key, coalesce(p_value, ''))
   where id = p_waiting_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC — waiting list to roster
--
-- Delegates to add_player(), so the roster limit, the finalized-team lock and
-- the contiguous 1..n positions stay owned by the code that already enforces
-- them.
-- ----------------------------------------------------------------------------

create or replace function public.promote_waiting_player(
  p_waiting_id uuid,
  p_team_id    uuid
)
returns public.players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wait public.waiting_list;
  v_row  public.players;
begin
  if not public.is_admin() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  select * into v_wait from public.waiting_list where id = p_waiting_id;
  if v_wait.id is null then
    raise exception 'waiting_not_found' using errcode = 'P0002';
  end if;

  v_row := public.add_player(p_team_id, v_wait.name);

  -- Carry the custom values across; the four sheet columns start blank.
  update public.players
     set custom = v_wait.custom
   where id = v_row.id
  returning * into v_row;

  delete from public.waiting_list where id = p_waiting_id;

  return v_row;
end;
$$;

-- ----------------------------------------------------------------------------
-- Grants. RLS still applies on top of these.
-- ----------------------------------------------------------------------------

grant select on public.custom_columns to authenticated;
grant select, insert, update, delete on public.waiting_list to authenticated;

revoke all on function public.finalize_team(uuid)                  from public, anon;
revoke all on function public.unfinalize_team(uuid)                from public, anon;
revoke all on function public.add_custom_column(text)              from public, anon;
revoke all on function public.rename_custom_column(uuid, text)     from public, anon;
revoke all on function public.delete_custom_column(uuid)           from public, anon;
revoke all on function public.set_player_custom(uuid, text, text)  from public, anon;
revoke all on function public.set_waiting_custom(uuid, text, text) from public, anon;
revoke all on function public.promote_waiting_player(uuid, uuid)   from public, anon;

grant execute on function public.finalize_team(uuid)                  to authenticated;
grant execute on function public.unfinalize_team(uuid)                to authenticated;
grant execute on function public.add_custom_column(text)              to authenticated;
grant execute on function public.rename_custom_column(uuid, text)     to authenticated;
grant execute on function public.delete_custom_column(uuid)           to authenticated;
grant execute on function public.set_player_custom(uuid, text, text)  to authenticated;
grant execute on function public.set_waiting_custom(uuid, text, text) to authenticated;
grant execute on function public.promote_waiting_player(uuid, uuid)   to authenticated;

-- ----------------------------------------------------------------------------
-- Realtime, so a second screen sees the pool and the lock change live.
-- ----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['waiting_list', 'custom_columns', 'teams'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end
$$;
