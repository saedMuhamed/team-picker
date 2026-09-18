import { pdf } from '@react-pdf/renderer'
import { TeamSheetDocument } from './TeamSheet'
import type { Player, Sheet, Team } from '@/lib/types'

function today() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Give Safari a moment before revoking, or the download never starts.
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function buildSheets(teams: Team[], players: Player[]): Sheet[] {
  return [...teams]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((team) => ({
      team,
      players: players
        .filter((p) => p.team_id === team.id)
        .sort((a, b) => a.position - b.position),
    }))
}

export interface ExportOptions {
  markCaptain?: boolean
}

/** One team, one page. */
export async function downloadTeamSheet(
  team: Team,
  players: Player[],
  options: ExportOptions = {},
) {
  const sheets = buildSheets([team], players)
  const blob = await pdf(
    <TeamSheetDocument sheets={sheets} markCaptain={options.markCaptain} />,
  ).toBlob()
  save(blob, `${slugify(team.display_name)}-${today()}.pdf`)
}

/** Every team, one page each, in seeded order. */
export async function downloadAllTeamSheets(
  teams: Team[],
  players: Player[],
  options: ExportOptions = {},
) {
  const sheets = buildSheets(teams, players)
  const blob = await pdf(
    <TeamSheetDocument sheets={sheets} markCaptain={options.markCaptain} />,
  ).toBlob()
  save(blob, `kooxda-all-teams-${today()}.pdf`)
}
