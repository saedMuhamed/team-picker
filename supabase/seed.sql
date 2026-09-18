-- ============================================================================
--  Team Picker — seed data
--  The six fixed teams, plus the rosters exactly as they appear on the paper
--  sheets. Position 1 of each team is the captain.
--  Re-running this resets every roster back to these names.
-- ============================================================================

insert into public.teams (slug, display_name, color_hex, text_hex, roster_size, sort_order) values
  ('white',  'KOOXDA WHITE TEAM',  '#FFFFFF', '#000000',  9, 1),
  ('yellow', 'KOOXDA YELLOW TEAM', '#FFFF00', '#000000',  9, 2),
  ('blue',   'KOOXDA BLUE TEAM',   '#0B5FFF', '#FFFFFF', 10, 3),
  ('green',  'KOOXDA GREEN TEAM',  '#00A94F', '#FFFFFF',  9, 4),
  ('black',  'KOOXDA BLACK TEAM',  '#111111', '#FFFFFF',  9, 5),
  ('red',    'KOOXDA RED TEAM',    '#F20D1B', '#FFFFFF',  9, 6)
on conflict (slug) do update set
  display_name = excluded.display_name,
  color_hex    = excluded.color_hex,
  text_hex     = excluded.text_hex,
  sort_order   = excluded.sort_order;

-- Rosters ---------------------------------------------------------------------

delete from public.players
where team_id in (
  select id from public.teams
  where slug in ('white', 'yellow', 'blue', 'green', 'black', 'red')
);

insert into public.players (team_id, position, name)
select t.id, v.position, v.name
from (values
  -- WHITE ------------------------------------------------------------------
  ('white',   1, 'Cabdimahad'),
  ('white',   2, 'Suhayb'),
  ('white',   3, 'Yusuf boobe'),
  ('white',   4, 'Ibrahim Safari'),
  ('white',   5, 'Cabdalle'),
  ('white',   6, 'Shagta'),
  ('white',   7, 'C/rasaq'),
  ('white',   8, 'Ismaciil'),
  ('white',   9, 'Gelle'),
  -- YELLOW -----------------------------------------------------------------
  ('yellow',  1, 'Luqmaan caduur'),
  ('yellow',  2, 'Siciid modrich'),
  ('yellow',  3, 'Xamse Oday'),
  ('yellow',  4, 'cabdiqani Cawil'),
  ('yellow',  5, 'Zakeriye Afgal'),
  ('yellow',  6, 'Ander'),
  ('yellow',  7, 'Raage'),
  ('yellow',  8, 'Mahir'),
  ('yellow',  9, 'Axmed Yasiin'),
  -- BLUE -------------------------------------------------------------------
  ('blue',    1, 'Xatto'),
  ('blue',    2, 'Taaxo'),
  ('blue',    3, 'Caano'),
  ('blue',    4, 'Ayaanle'),
  ('blue',    5, 'Siciid'),
  ('blue',    6, 'Xeefo'),
  ('blue',    7, 'Adaa'),
  ('blue',    8, 'Abokor'),
  ('blue',    9, 'Cawlo'),
  ('blue',   10, 'Liibaan'),
  -- GREEN (7 of 9 slots filled) --------------------------------------------
  ('green',   1, 'Fuaad'),
  ('green',   2, 'C/rasaq'),
  ('green',   3, 'Awga'),
  ('green',   4, 'C/rashiid'),
  ('green',   5, 'Mukhtaar'),
  ('green',   6, 'Dhago Yare'),
  ('green',   7, 'khadar Dheere'),
  -- BLACK (8 of 9 slots filled) --------------------------------------------
  ('black',   1, 'Karaase'),
  ('black',   2, 'Aleeli'),
  ('black',   3, 'Xaraaro'),
  ('black',   4, 'Abokor'),
  ('black',   5, 'Zamiir'),
  ('black',   6, 'C/kariin Sheekh'),
  ('black',   7, 'Xamse UK'),
  ('black',   8, 'Boondaro'),
  -- RED (8 of 9 slots filled) ----------------------------------------------
  ('red',     1, 'Khadar Bulaale'),
  ('red',     2, 'Muuse'),
  ('red',     3, 'Ibrahim'),
  ('red',     4, 'Carab'),
  ('red',     5, 'Salmaan'),
  ('red',     6, 'Gardaf'),
  ('red',     7, 'C/kariin Saleban'),
  ('red',     8, 'Qaadiro')
) as v (slug, position, name)
join public.teams t on t.slug = v.slug;
