import { Link, useParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { HeaderBand } from '@/components/HeaderBand'
import { ChevronLeft } from '@/components/icons'
import { PdfButton } from '@/components/PdfButton'
import { RosterTable } from '@/components/RosterTable'
import { RosterSkeleton } from '@/components/Skeleton'
import { useToast } from '@/components/Toast'
import {
  usePendingWrites,
  usePlayers,
  usePlayersRealtime,
  useTeamPlayers,
  useTeams,
  useUpdateRosterSize,
} from '@/hooks/useTeamData'
import { PRINT_CAPTAIN_MARK } from '@/lib/config'
import { exportTeamSheet } from '@/pdf/lazy'
import { readableError } from '@/lib/supabase'
import { S } from '@/lib/strings'

export function TeamView() {
  const { slug } = useParams<{ slug: string }>()
  const { isAdmin, canEditTeam } = useAuth()
  const toast = useToast()

  const teamsQuery = useTeams()
  const allPlayersQuery = usePlayers()
  usePlayersRealtime(true)

  const team = teamsQuery.data?.find((t) => t.slug === slug)
  const { players } = useTeamPlayers(team?.id)
  const pendingWrites = usePendingWrites()
  const updateRosterSize = useUpdateRosterSize()

  const canEdit = canEditTeam(team?.id)
  const loading = teamsQuery.isLoading || allPlayersQuery.isLoading

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-14 animate-pulse rounded bg-neutral-200" />
        <RosterSkeleton />
      </div>
    )
  }

  if (!team) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-6 text-center">
        <p className="text-neutral-600">{S.notFound}</p>
        <Link to="/" className="btn-ghost mt-4">
          {S.back}
        </Link>
      </div>
    )
  }

  return (
    <div>
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-500 transition hover:text-ink"
      >
        <ChevronLeft className="h-4 w-4" />
        {S.back}
      </Link>

      <HeaderBand team={team} />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            canEdit
              ? 'bg-emerald-100 text-emerald-800'
              : 'bg-neutral-200 text-neutral-600'
          }`}
        >
          {canEdit ? S.editing : S.viewOnly}
        </span>

        {canEdit && (
          <span className="text-xs text-neutral-500" aria-live="polite">
            {pendingWrites > 0 ? S.saving : S.saved}
          </span>
        )}

        {isAdmin && (
          <label className="flex items-center gap-2 text-xs text-neutral-500">
            {S.rosterSize}
            <input
              type="number"
              min={Math.max(5, players.length)}
              max={20}
              defaultValue={team.roster_size}
              className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-sm tabular-nums"
              onBlur={(e) => {
                const size = Number(e.target.value)
                if (!Number.isFinite(size) || size === team.roster_size) return
                if (size < players.length) {
                  toast(
                    `This team already has ${players.length} players.`,
                    'error',
                  )
                  e.target.value = String(team.roster_size)
                  return
                }
                const clamped = Math.min(20, Math.max(5, Math.round(size)))
                e.target.value = String(clamped)
                updateRosterSize.mutate(
                  { teamId: team.id, size: clamped },
                  { onError: (err) => toast(readableError(err), 'error') },
                )
              }}
            />
          </label>
        )}

        <PdfButton
          className="ml-auto"
          variant="primary"
          onExport={() =>
            exportTeamSheet(team, players, { markCaptain: PRINT_CAPTAIN_MARK })
          }
        >
          {S.downloadPdf}
        </PdfButton>
      </div>

      <div className="mt-4">
        <RosterTable team={team} players={players} canEdit={canEdit} />
      </div>

      {!canEdit && (
        <p className="mt-4 text-sm text-neutral-500">
          You can view and export this sheet. Ask the admin to turn on editing if
          you need to change it.
        </p>
      )}
    </div>
  )
}
