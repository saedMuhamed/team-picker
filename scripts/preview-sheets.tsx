/**
 * Renders the seeded rosters to a PDF in Node, without needing Supabase or a
 * browser. Use it to eyeball the printed sheet after changing the layout:
 *
 *   npm run preview:pdf   ->  preview/team-sheets.pdf
 */
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { renderToFile } from '@react-pdf/renderer'
import { TeamSheetDocument, registerSheetFonts } from '../src/pdf/TeamSheet'
import type { Player, Sheet, Team } from '../src/lib/types'

// npm scripts run from the project root; the bundled script lives elsewhere.
const root = process.cwd()

// In Node the fonts come off disk rather than from the dev server.
registerSheetFonts(path.join(root, 'public', 'fonts'))

const TEAMS: Array<Omit<Team, 'id'> & { id: string }> = [
  { id: 't1', slug: 'white', display_name: 'KOOXDA WHITE TEAM', color_hex: '#FFFFFF', text_hex: '#000000', roster_size: 9, sort_order: 1 },
  { id: 't2', slug: 'yellow', display_name: 'KOOXDA YELLOW TEAM', color_hex: '#FFFF00', text_hex: '#000000', roster_size: 9, sort_order: 2 },
  { id: 't3', slug: 'blue', display_name: 'KOOXDA BLUE TEAM', color_hex: '#0B5FFF', text_hex: '#FFFFFF', roster_size: 10, sort_order: 3 },
  { id: 't4', slug: 'green', display_name: 'KOOXDA GREEN TEAM', color_hex: '#00A94F', text_hex: '#FFFFFF', roster_size: 9, sort_order: 4 },
  { id: 't5', slug: 'black', display_name: 'KOOXDA BLACK TEAM', color_hex: '#111111', text_hex: '#FFFFFF', roster_size: 9, sort_order: 5 },
  { id: 't6', slug: 'red', display_name: 'KOOXDA RED TEAM', color_hex: '#F20D1B', text_hex: '#FFFFFF', roster_size: 9, sort_order: 6 },
]

const ROSTERS: Record<string, string[]> = {
  white: ['Cabdimahad', 'Suhayb', 'Yusuf boobe', 'Ibrahim Safari', 'Cabdalle', 'Shagta', 'C/rasaq', 'Ismaciil', 'Gelle'],
  yellow: ['Luqmaan caduur', 'Siciid modrich', 'Xamse Oday', 'cabdiqani Cawil', 'Zakeriye Afgal', 'Ander', 'Raage', 'Mahir', 'Axmed Yasiin'],
  blue: ['Xatto', 'Taaxo', 'Caano', 'Ayaanle', 'Siciid', 'Xeefo', 'Adaa', 'Abokor', 'Cawlo', 'Liibaan'],
  green: ['Fuaad', 'C/rasaq', 'Awga', 'C/rashiid', 'Mukhtaar', 'Dhago Yare', 'khadar Dheere'],
  black: ['Karaase', 'Aleeli', 'Xaraaro', 'Abokor', 'Zamiir', 'C/kariin Sheekh', 'Xamse UK', 'Boondaro'],
  red: ['Khadar Bulaale', 'Muuse', 'Ibrahim', 'Carab', 'Salmaan', 'Gardaf', 'C/kariin Saleban', 'Qaadiro'],
}

// A couple of filled-in values on the first sheet, to check that typed text
// prints and that long text wraps instead of clipping.
const SAMPLE_VALUES: Record<string, [string, string, string]> = {
  Cabdimahad: ['Fit', 'Joogto', 'Aad u wanaagsan'],
  Suhayb: ['Dhaawac', '2/4', 'Wanaagsan'],
  'Yusuf boobe': ['Fit', 'Joogto', 'Dhexdhexaad ah oo sii wanaagsanaanaya'],
}

function toPlayer(teamId: string, name: string, position: number): Player {
  const extra = SAMPLE_VALUES[name]
  return {
    id: `${teamId}-${position}`,
    team_id: teamId,
    position,
    name,
    xaalada: extra?.[0] ?? '',
    joogtaynta: extra?.[1] ?? '',
    heerka_kubada: extra?.[2] ?? '',
    created_at: '',
    updated_at: '',
  }
}

const sheets: Sheet[] = TEAMS.map((team) => ({
  team,
  players: (ROSTERS[team.slug] ?? []).map((name, i) =>
    toPlayer(team.id, name, i + 1),
  ),
}))

const outDir = path.join(root, 'preview')
mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, 'team-sheets.pdf')

await renderToFile(<TeamSheetDocument sheets={sheets} />, outFile)
console.log(`Wrote ${outFile}`)
