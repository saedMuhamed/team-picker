import type { Team } from '@/lib/types'

/**
 * The coloured title bar from the paper sheet, reused on screen so the app
 * and the PDF read as the same object.
 */
export function HeaderBand({
  team,
  size = 'md',
}: {
  team: Team
  size?: 'sm' | 'md'
}) {
  return (
    <div
      className={`flex items-center justify-center border border-black px-3 text-center font-bold tracking-wide ${
        size === 'sm' ? 'h-11 text-sm' : 'h-14 text-lg sm:text-xl'
      }`}
      style={{ backgroundColor: team.color_hex, color: team.text_hex }}
    >
      {team.display_name}
    </div>
  )
}
