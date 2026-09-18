export type Role = 'admin' | 'captain'

export interface Team {
  id: string
  slug: string
  display_name: string
  color_hex: string
  text_hex: string
  roster_size: number
  sort_order: number
}

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  role: Role
  team_id: string | null
  can_edit: boolean
  created_at: string
}

export interface Player {
  id: string
  team_id: string
  position: number
  name: string
  xaalada: string
  joogtaynta: string
  heerka_kubada: string
  created_at: string
  updated_at: string
}

/** The four free-text columns on the sheet. */
export type PlayerField = 'name' | 'xaalada' | 'joogtaynta' | 'heerka_kubada'

/** One team plus its roster — what both the screen and the PDF render from. */
export interface Sheet {
  team: Team
  players: Player[]
}

/**
 * A printed row. `player` is null for the empty numbered slots that pad a
 * roster out to the team's roster_size.
 */
export interface SheetRow {
  position: number
  player: Player | null
}

/** Pads a roster to `roster_size`, so screen and PDF always agree on rows. */
export function toSheetRows(players: Player[], rosterSize: number): SheetRow[] {
  const ordered = [...players].sort((a, b) => a.position - b.position)
  const total = Math.max(rosterSize, ordered.length)
  return Array.from({ length: total }, (_, i) => ({
    position: i + 1,
    player: ordered[i] ?? null,
  }))
}
