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
   - `supabase/seed.sql` — the six teams and the rosters from the paper sheets

   (With the Supabase CLI instead: `supabase db push`, then
   `psql "$DATABASE_URL" -f supabase/seed.sql`.)

Re-running the seed resets every roster back to the original names, so do it
only on a fresh project or when you deliberately want to start over.

## 2. Create the seven accounts

Go to **Authentication → Users → Add user**, and create seven users with
**Auto Confirm User** switched on:

| Email | Becomes |
|---|---|
| your own email | admin |
| six captain emails | one per team |

A database trigger creates a matching `profiles` row for each new user as a
view-only captain with no team. Then promote yourself to admin — **SQL Editor**:

```sql
update public.profiles
set role = 'admin', team_id = null
where email = 'you@example.com';
```

Assign the captains to their teams from inside the app (**Access** screen), or
in SQL if you prefer:

```sql
update public.profiles
set team_id = (select id from public.teams where slug = 'white')
where email = 'white-captain@example.com';
```

Leave `can_edit` off until you want that captain to be able to change their
roster. You flip it on the Access screen, and it takes effect immediately.

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

**Vercel / Netlify:** build command `npm run build`, output directory `dist`.
Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as environment variables.
Because the app uses client-side routing, add a rewrite of all paths to
`/index.html` (Netlify: a `_redirects` file with `/*  /index.html  200`;
Vercel detects Vite and handles this automatically).

The anon key is meant to be public — Row Level Security, not secrecy, is what
protects the data. Never put the **service role** key in this app.

---

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
  hooks/useTeamData.ts      all queries and mutations, optimistic + realtime
  lib/                      supabase client, types, strings, config
  pages/                    Login, Dashboard, TeamView, Access, fallbacks
  pdf/TeamSheet.tsx         the printed sheet — single source of truth
  pdf/export.tsx            single-team and all-teams downloads
  pdf/lazy.ts               loads the PDF renderer on first download
supabase/migrations/        schema, RLS, RPCs
supabase/seed.sql           six teams + rosters
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
