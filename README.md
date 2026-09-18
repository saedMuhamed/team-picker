# Team Picker

Manage six fixed football teams and print a roster sheet for each one.
React + Vite + TypeScript on the front, Supabase (Postgres, Auth, Row Level
Security) for everything else. No server of your own to run.

- **Admin** sees all six teams, edits every roster, and decides which captains
  may edit theirs.
- **Six captains**, one per team. View-only by default; the admin grants edit
  rights per captain, and that permission is enforced by the database.
- **Position 1 is always the captain.** Adding, deleting and reordering keep
  positions contiguous `1..n`.
- **Waiting list** — one club-wide pool of players not yet picked, each with a
  playing position and a level. The admin assigns one to a team in a click.
- **Final teams** — finalizing freezes a roster in the database and unlocks
  its PDF. Nobody can edit it again until the admin reopens it.
- **Custom columns** — the admin can add, rename and remove extra columns,
  shared by every roster and the waiting list.
- **PDF export** — one team per page, matching the paper sheets: coloured
  header band, five columns (`No`, `Magaca`, `Xaalada`, `Joogtaynta`,
  `Heerka Kubada`), full black grid, and empty numbered rows for the slots you
  fill in by hand.

---

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com). Note the project
   URL and the **anon public** key from **Project Settings → API**.
2. Open **SQL Editor** and run, in this order:
   - `supabase/migrations/0001_init.sql` — tables, RLS policies, RPCs
   - `supabase/migrations/0002_features.sql` — waiting list, final teams,
     custom columns
   - `supabase/seed.sql` — the six teams and the rosters from the paper sheets
   - `supabase/users.sql` — the six captain accounts

   (With the Supabase CLI instead: `supabase db push`, then
   `psql "$DATABASE_URL" -f supabase/seed.sql -f supabase/users.sql`.)

   `0002` replaces `can_edit_team()` and one policy from `0001`, so if you ever
   re-run `0001` on its own, re-run `0002` after it — otherwise the
   finalized-team lock quietly stops working.

Re-running the seed resets every roster back to the original names, so do it
only on a fresh project or when you deliberately want to start over.

## 2. Accounts

### The six captains

`supabase/users.sql` creates them, already pointed at their teams:

| Username | Team |
|---|---|
| `cabdimahad` | White |
| `luqmancaduur` | Yellow |
| `xatto` | Blue |
| `fuaad` | Green |
| `aleeli` | Black |
| `bulaale` | Red |

They sign in with the **username**, not an email. Supabase Auth only knows how
to look people up by email, so the app appends `@teampicker.local` on submit —
`xatto` is stored as `xatto@teampicker.local`. That domain is
`USERNAME_DOMAIN` in `src/lib/config.ts`; changing it after the accounts exist
locks everyone out, so change `supabase/users.sql` too and re-run it.

Passwords are hashed with bcrypt by `crypt()`/`gen_salt('bf')` — the plain text
never reaches the database. It *is* in `supabase/users.sql`, which is why that
file is gitignored. Change the passwords once everyone has signed in once.
Re-running the script resets the six passwords, which is the quickest way to
recover a locked-out captain; it leaves `can_edit` alone.

All six start **view-only**. Turn editing on per captain from the **Access**
screen; it takes effect on their next load or window focus.

### Yourself, as admin

Create your own account at **Authentication → Users → Add user** with **Auto
Confirm User** switched on, then promote it — **SQL Editor**:

```sql
update public.profiles
set role = 'admin', team_id = null
where email = 'you@example.com';
```

A database trigger created the `profiles` row when the user was added. If that
select comes back empty, the user predates `0001_init.sql`; backfill with:

```sql
insert into public.profiles (id, email, full_name, role)
select id, email, split_part(email, '@', 1), 'admin'
from auth.users where email = 'you@example.com'
on conflict (id) do update set role = 'admin', team_id = null;
```

## 3. Run the app

```bash
cp .env.example .env     # then fill in the two values
npm install
npm run dev
```

If `.env` is missing or unfilled the app shows a setup notice instead of a
blank page.

Other scripts:

```bash
npm run typecheck    # tsc --noEmit
npm run build        # typecheck + production build into dist/
npm run preview:pdf  # render the seeded sheets to preview/team-sheets.pdf
```

`preview:pdf` renders the real PDF component in Node — no browser, no
Supabase — which is the quickest way to check a layout change.

## 4. Deploy

Any static host works; the build output is `dist/`.

**Netlify:** `netlify.toml` already sets the build command, the publish
directory and the SPA rewrite, so a fresh site needs nothing configured by
hand — except the two environment variables.

**Vercel:** build command `npm run build`, output directory `dist`. It detects
Vite and handles the rewrite itself.

**Both:** add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under the site's
environment variables, then redeploy. They are read at *build* time, so a
deploy that ran before you set them keeps the old values baked in and the app
shows the setup notice — a rebuild is what picks them up, not a page refresh.

The app uses client-side routing, so `/waiting` and `/team/white` are not files
on disk. Without a rewrite of every unmatched path to `/index.html`, the host
returns its own 404 for those URLs — that is what `public/_redirects` and the
`[[redirects]]` block in `netlify.toml` are for. The 404 only appears on a
hard load or refresh of a deep link; clicking through from the homepage works
either way, which makes it easy to miss until someone bookmarks a page.

The anon key is meant to be public — Row Level Security, not secrecy, is what
protects the data. Never put the **service role** key in this app.

---

## The waiting list

One global pool at `/waiting`, held in `public.waiting_list`. Everyone signed
in can read it; only the admin can change it. Each entry carries a name, a
playing position and a level (`beginner` / `intermediate` / `advanced` / `pro`).

`payment_status` and `amount` still exist on the table but are no longer shown
— the screen was too wide with them. To bring them back, add the two cells to
`src/pages/WaitingList.tsx`; nothing was dropped. To retire them for good:

```sql
alter table public.waiting_list
  drop column payment_status,
  drop column amount;
```

**Assign to…** on a row calls `promote_waiting_player()`, which delegates to
`add_player()` and then deletes the pool entry. Delegating rather than
inserting directly is the point: the roster limit, the finalized-team lock and
the contiguous `1..n` positions stay enforced by the code that already owns
those rules, and the entry only leaves the pool once the player has landed. A
team that is full or finalized is disabled in the dropdown, and refused by the
database besides.

## Final teams

`teams.is_final` is the lock. `can_edit_team()` returns false for a finalized
team no matter who asks, so every write path — the `players` policies and the
`add_player` / `delete_player` / `reorder_players` / `set_player_custom` RPCs —
refuses at once, and `roster_size` freezes with it. The UI going read-only is
the visible half of a rule the database enforces anyway.

Only the admin can finalize (`finalize_team()`, which needs at least one player
on the roster) or reopen (`unfinalize_team()`). Both are `SECURITY DEFINER`, so
they are the only way past the policy that otherwise blocks updates to a final
team.

A team must be final before its sheet can be exported — on its own page, on its
dashboard card, and in **Download all**, which prints the finalized teams and
says so in its label. Set `REQUIRE_FINAL_FOR_PDF` to `false` in
`src/lib/config.ts` to allow printing drafts.

## Custom columns

One global set in `public.custom_columns`, shared by every roster and the
waiting list, managed by the admin from the **Columns** panel on any team page
or the waiting list.

Values live in a `jsonb` bag on `players.custom` and `waiting_list.custom`,
keyed by `custom_columns.key`. The key is generated from the first label and
never changes, so **renaming a column touches no data at all**. Removing one
deletes the definition *and* strips its key out of every stored bag, so nothing
lingers to resurface if a later column is given the same name — that is why
removal asks for confirmation.

Adding a column is a metadata insert rather than `alter table`, which matters
here: the roster tables are under row level security with column-level grants,
and a schema change per column would have to keep both in step.

These columns are **screen only**. The printed sheet keeps its five paper
columns at their exact widths; on screen the five narrow evenly to make room
and the table scrolls sideways rather than squeezing past legibility.

## How permissions work

Two SQL helpers back every policy:

- `is_admin()` — is the current user the admin?
- `can_edit_team(team_id)` — admin, or the captain of that team **with
  `can_edit` on**?

`players` allows `select` to anyone signed in (captains can look at the other
teams) but gates `insert`, `update` and `delete` behind `can_edit_team()`. The
UI hiding the buttons is a convenience; revoking a captain's access stops the
writes at the database, whatever request they send.

Adding, deleting and reordering go through `SECURITY DEFINER` functions
(`add_player`, `delete_player`, `reorder_players`) that re-check permission
themselves and do their work in a single transaction, so positions can never
end up duplicated or with a gap. The unique constraint on `(team_id, position)`
is `DEFERRABLE INITIALLY DEFERRED` so a reorder can shuffle rows freely and is
still checked at commit.

## Project layout

```
src/
  auth/AuthProvider.tsx     session + profile, isAdmin, canEditTeam()
  components/               layout, roster table, editable cell, dialogs, toasts
  components/ColumnManager  add / rename / remove the custom columns
  hooks/useTeamData.ts      teams + rosters, finalizing, optimistic + realtime
  hooks/useWaitingList.ts   the pool, and promoting out of it
  hooks/useCustomColumns.ts the global column definitions
  lib/                      supabase client, types, strings, config
  pages/                    Login, Dashboard, TeamView, WaitingList, Access
  pdf/TeamSheet.tsx         the printed sheet — single source of truth
  pdf/export.tsx            single-team and all-teams downloads
  pdf/lazy.ts               loads the PDF renderer on first download
supabase/migrations/        schema, RLS, RPCs
supabase/seed.sql           six teams + rosters
supabase/users.sql          the six captain accounts (gitignored)
scripts/preview-sheets.tsx  render sheets to PDF from the command line
public/fonts/               Poppins (OFL), embedded in the PDF
```

## Things you may want to change

- **Captain mark on the PDF.** The captain prints in bold with a trailing
  `(C)`. Set `PRINT_CAPTAIN_MARK` to `false` in `src/lib/config.ts` for sheets
  identical to the originals.
- **Roster slots.** The number of printed rows per team. Admin-editable at the
  top of each team's page (5–20). Green, black and red are seeded at 9 with
  fewer players, which is why their sheets print empty numbered rows.
- **Sheet layout.** Column widths, row heights, fonts and the header band are
  all constants at the top of `src/pdf/TeamSheet.tsx`. Both exports render
  through that one component, so they cannot drift apart.
- **Wording.** Every user-facing string is in `src/lib/strings.ts`.

## Known deviations from the spec

- **Reordering uses up/down arrows, not drag-and-drop.** Dragging table rows
  needs transform hacks that break the grid, and arrows are easier to hit on a
  phone at the pitch. The atomic `reorder_players` RPC underneath is the same
  either way, so swapping in a drag library later touches only the table
  component.
- **`can_edit` reaches a captain on their next load or window focus** (the
  profile refetches then), not instantly via a realtime push. Roster edits
  *are* pushed live between users.

Poppins is bundled under the SIL Open Font License; see
`public/fonts/OFL.txt`.
