export type Role = 'admin' | 'captain'

export interface Team {
  id: string
  slug: string
  display_name: string
  color_hex: string
  text_hex: string
  roster_size: number
  sort_order: number
  /** A finalized team is frozen: no roster writes, and the sheet may be printed. */
  is_final: boolean
  finalized_at: string | null
  finalized_by: string | null
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
  /** Values for the admin-defined columns, keyed by CustomColumn.key. */
  custom: CustomValues
  created_at: string
  updated_at: string
}

/** The four free-text columns on the sheet. */
export type PlayerField = 'name' | 'xaalada' | 'joogtaynta' | 'heerka_kubada'

/* -------------------------------------------------------------------------- */
/* Custom columns                                                             */
/* -------------------------------------------------------------------------- */

/**
 * An admin-defined column. One global set, shared by every roster and the
 * waiting list. `key` is generated once and never changes, so renaming a
 * column leaves every stored value exactly where it is.
 */
export interface CustomColumn {
  id: string
  key: string
  label: string
  sort_order: number
  created_at: string
}

/** A row's values for the custom columns. A missing key was never filled in. */
export type CustomValues = Record<string, string>

export function customValue(
  values: CustomValues | null | undefined,
  key: string,
): string {
  return values?.[key] ?? ''
}

/* -------------------------------------------------------------------------- */
/* Waiting list                                                               */
/* -------------------------------------------------------------------------- */

export type PlayerLevel = 'beginner' | 'intermediate' | 'advanced' | 'pro'
export type PaymentStatus = 'paid' | 'pending' | 'unpaid'

export const PLAYER_LEVELS: readonly PlayerLevel[] = [
  'beginner',
  'intermediate',
  'advanced',
  'pro',
]

export const PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'paid',
  'pending',
  'unpaid',
]

/** One person in the global pool, not yet picked for a team. */
export interface WaitingPlayer {
  id: string
  name: string
  playing_position: string
  level: PlayerLevel
  payment_status: PaymentStatus
  /** Optional, and only meaningful next to payment_status. */
  amount: number | null
  custom: CustomValues
  created_at: string
  updated_at: string
}

/** The fields of a waiting list entry that are edited in place. */
export type WaitingField =
  | 'name'
  | 'playing_position'
  | 'level'
  | 'payment_status'
  | 'amount'

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
