import type { Player, Team } from '@/lib/types'
import type { ExportOptions } from './export'

/**
 * The PDF renderer is a large dependency, so it is loaded on first download
 * rather than in the initial bundle.
 */

export async function exportTeamSheet(
  team: Team,
  players: Player[],
  options: ExportOptions = {},
) {
  const { downloadTeamSheet } = await import('./export')
  return downloadTeamSheet(team, players, options)
}

export async function exportAllTeamSheets(
  teams: Team[],
  players: Player[],
  options: ExportOptions = {},
) {
  const { downloadAllTeamSheets } = await import('./export')
  return downloadAllTeamSheets(teams, players, options)
}
