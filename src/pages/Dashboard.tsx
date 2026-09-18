import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { HeaderBand } from '@/components/HeaderBand'
import { PdfButton } from '@/components/PdfButton'
import { TeamCardSkeleton } from '@/components/Skeleton'
import { usePlayers, usePlayersRealtime, useTeams } from '@/hooks/useTeamData'
import { PRINT_CAPTAIN_MARK } from '@/lib/config'
import { exportAllTeamSheets, exportTeamSheet } from '@/pdf/lazy'
import { readableError } from '@/lib/supabase'
import { S } from '@/lib/strings'

export function Dashboard() {
  const { profile, canEditTeam } = useAuth()
  const teamsQuery = useTeams()
  const playersQuery = usePlayers()
  usePlayersRealtime(true)

  const teams = teamsQuery.data ?? []
  const players = playersQuery.data ?? []
  const loading = teamsQuery.isLoading || playersQuery.isLoading
  const error = teamsQuery.error ?? playersQuery.error

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {readableError(error)}
        <button
          type="button"
          className="btn-ghost ml-3 !py-1"
          onClick={() => {
            void teamsQuery.refetch()
            void playersQuery.refetch()
          }}
        >
          {S.retry}
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{S.dashboard}</h1>
        <PdfButton
          variant="primary"
          className="ml-auto"
          disabled={loading || teams.length === 0}
          onExport={() =>
            exportAllTeamSheets(teams, players, {
              markCaptain: PRINT_CAPTAIN_MARK,
            })
          }
        >
          {S.downloadAll}
        </PdfButton>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading &&
          Array.from({ length: 6 }, (_, i) => <TeamCardSkeleton key={i} />)}

        {!loading &&
          teams.map((team) => {
            const roster = players
              .filter((p) => p.team_id === team.id)
              .sort((a, b) => a.position - b.position)
            const captain = roster[0]
            const isMine = profile?.team_id === team.id
            const editable = canEditTeam(team.id)

            return (
              <div
                key={team.id}
                className={`overflow-hidden rounded-xl border bg-white shadow-sm transition hover:shadow-md ${
                  isMine ? 'border-ink ring-1 ring-ink' : 'border-neutral-200'
                }`}
              >
                <HeaderBand team={team} size="sm" />

                <div className="p-4">
                  {isMine && (
                    <span className="mb-2 inline-block rounded-full bg-ink px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-white">
                      {S.yourTeam}
                    </span>
                  )}

                  <dl className="space-y-1 text-sm">
                    <div className="flex justify-between gap-2">
                      <dt className="text-neutral-500">{S.captain}</dt>
                      <dd className="truncate font-medium">
                        {captain ? captain.name : '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-neutral-500">{S.players}</dt>
                      <dd className="tabular-nums font-medium">
                        {roster.length} / {team.roster_size}
                      </dd>
                    </div>
                  </dl>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link to={`/team/${team.slug}`} className="btn-ghost">
                      {editable ? 'Open' : S.view}
                    </Link>
                    <PdfButton
                      onExport={() =>
                        exportTeamSheet(team, players, {
                          markCaptain: PRINT_CAPTAIN_MARK,
                        })
                      }
                    >
                      PDF
                    </PdfButton>
                  </div>
                </div>
              </div>
            )
          })}
      </div>
    </div>
  )
}
