import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer'
import { S } from '@/lib/strings'
import { toSheetRows, type Sheet } from '@/lib/types'

/* --------------------------------------------------------------------------
 * Fonts. The TTFs live in public/fonts, so they are same-origin and there is
 * no CDN or CORS dependency at print time.
 * -------------------------------------------------------------------------- */

/**
 * `base` is a URL prefix in the browser; the verification script passes an
 * absolute filesystem path so it can render the same sheet in Node.
 */
let fontsRegistered = false

export function registerSheetFonts(base = '/fonts') {
  Font.register({
    family: 'Poppins',
    fonts: [
      { src: `${base}/Poppins-Regular.ttf`, fontWeight: 400 },
      { src: `${base}/Poppins-Bold.ttf`, fontWeight: 700 },
    ],
  })
  fontsRegistered = true
}

// Registered on first render rather than at import, so a caller that has
// already registered its own paths (the Node preview script) wins.
function ensureFonts() {
  if (!fontsRegistered) registerSheetFonts()
}

// Names must never be broken across lines with a hyphen.
Font.registerHyphenationCallback((word) => [word])

/* --------------------------------------------------------------------------
 * Layout constants — the single source of truth for how a sheet looks.
 * Both the single-team and all-teams exports render through this file, so the
 * two can never drift apart.
 * -------------------------------------------------------------------------- */

const COLUMNS = [
  { key: 'no', label: S.col.no, width: '7%', align: 'right' as const },
  { key: 'name', label: S.col.name, width: '33%', align: 'left' as const },
  { key: 'xaalada', label: S.col.xaalada, width: '19%', align: 'left' as const },
  {
    key: 'joogtaynta',
    label: S.col.joogtaynta,
    width: '19%',
    align: 'left' as const,
  },
  {
    key: 'heerka_kubada',
    label: S.col.heerkaKubada,
    width: '22%',
    align: 'left' as const,
  },
]

const BORDER = 1
const BLACK = '#000000'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Poppins',
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 40,
    backgroundColor: '#FFFFFF',
  },
  // Header band: the team colour across the full width of the table.
  band: {
    borderTopWidth: BORDER,
    borderLeftWidth: BORDER,
    borderRightWidth: BORDER,
    borderColor: BLACK,
    borderStyle: 'solid',
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  bandText: {
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  // Table: outer view carries the top and left rule, each cell carries its
  // own right and bottom rule, so no line is ever drawn twice.
  table: {
    borderTopWidth: BORDER,
    borderLeftWidth: BORDER,
    borderColor: BLACK,
    borderStyle: 'solid',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  cell: {
    borderRightWidth: BORDER,
    borderBottomWidth: BORDER,
    borderColor: BLACK,
    borderStyle: 'solid',
    paddingHorizontal: 5,
    paddingVertical: 4,
    justifyContent: 'center',
  },
  headerCell: {
    minHeight: 24,
  },
  headerText: {
    fontSize: 10.5,
    fontWeight: 400,
  },
  bodyCell: {
    minHeight: 28,
  },
  bodyText: {
    fontSize: 11,
    fontWeight: 400,
  },
  captainText: {
    fontSize: 11,
    fontWeight: 700,
  },
})

export interface TeamSheetOptions {
  /** Print the captain's name in bold with a trailing (C). */
  markCaptain?: boolean
}

function TeamSheetPage({
  sheet,
  markCaptain = true,
}: { sheet: Sheet } & TeamSheetOptions) {
  const { team, players } = sheet
  const rows = toSheetRows(players, team.roster_size)

  return (
    <Page size="A4" orientation="portrait" style={styles.page} wrap={false}>
      <View
        style={[styles.band, { backgroundColor: team.color_hex }]}
        fixed={false}
      >
        <Text style={[styles.bandText, { color: team.text_hex }]}>
          {team.display_name}
        </Text>
      </View>

      <View style={styles.table}>
        {/* Column headers */}
        <View style={styles.row}>
          {COLUMNS.map((col) => (
            <View
              key={col.key}
              style={[styles.cell, styles.headerCell, { width: col.width }]}
            >
              <Text style={styles.headerText}>{col.label}</Text>
            </View>
          ))}
        </View>

        {/* One row per slot: filled players first, then empty numbered slots */}
        {rows.map((row) => {
          const isCaptain = row.position === 1 && row.player !== null
          const nameStyle =
            isCaptain && markCaptain ? styles.captainText : styles.bodyText

          return (
            <View key={row.position} style={styles.row} wrap={false}>
              <View
                style={[styles.cell, styles.bodyCell, { width: COLUMNS[0].width }]}
              >
                <Text style={[styles.bodyText, { textAlign: 'right' }]}>
                  {row.position}
                </Text>
              </View>

              <View
                style={[styles.cell, styles.bodyCell, { width: COLUMNS[1].width }]}
              >
                <Text style={nameStyle}>
                  {row.player
                    ? isCaptain && markCaptain
                      ? `${row.player.name} (${S.captainShort})`
                      : row.player.name
                    : ''}
                </Text>
              </View>

              <View
                style={[styles.cell, styles.bodyCell, { width: COLUMNS[2].width }]}
              >
                <Text style={styles.bodyText}>{row.player?.xaalada ?? ''}</Text>
              </View>

              <View
                style={[styles.cell, styles.bodyCell, { width: COLUMNS[3].width }]}
              >
                <Text style={styles.bodyText}>{row.player?.joogtaynta ?? ''}</Text>
              </View>

              <View
                style={[styles.cell, styles.bodyCell, { width: COLUMNS[4].width }]}
              >
                <Text style={styles.bodyText}>
                  {row.player?.heerka_kubada ?? ''}
                </Text>
              </View>
            </View>
          )
        })}
      </View>
    </Page>
  )
}

/**
 * One page per team. A single-team export passes one sheet; the all-teams
 * export passes all six in seeded order.
 */
export function TeamSheetDocument({
  sheets,
  markCaptain = true,
}: { sheets: Sheet[] } & TeamSheetOptions) {
  ensureFonts()

  return (
    <Document
      title={
        sheets.length === 1 ? sheets[0].team.display_name : 'Kooxaha — All teams'
      }
      author="Team Picker"
    >
      {sheets.map((sheet) => (
        <TeamSheetPage
          key={sheet.team.id}
          sheet={sheet}
          markCaptain={markCaptain}
        />
      ))}
    </Document>
  )
}
