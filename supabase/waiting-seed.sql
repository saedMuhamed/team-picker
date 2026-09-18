-- ============================================================================
--  Team Picker — waiting list starters
--
--  Run after 0002_features.sql. Safe to re-run: a name already in the pool is
--  skipped rather than duplicated.
--
--  Everyone lands on the defaults — level 'beginner', no playing position.
--  Set the real values on the Waiting list screen, or edit them here first.
-- ============================================================================

insert into public.waiting_list (name)
select v.name
from (values
  ('Yaxye Cali'),
  ('Luqman Khadar Ciise'),
  ('Axmed Ronaldo'),
  ('C/wahab')
) as v (name)
where not exists (
  select 1 from public.waiting_list w where w.name = v.name
);

-- What you should see: the four names, oldest first.
select name, playing_position, level
from public.waiting_list
order by created_at;
