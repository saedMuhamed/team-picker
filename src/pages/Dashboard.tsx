import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { HeaderBand } from '@/components/HeaderBand'
import { PdfButton } from '@/components/PdfButton'
import { TeamCardSkeleton } from '@/components/Skeleton'
import { Lock } from '@/components/icons'
import {
  usePlayers,
  usePlayersRealtime,
  useTeams,
  useTeamsRealtime,
} from '@/hooks/useTeamData'
import { PRINT_CAPTAIN_MARK, REQUIRE_FINAL_FOR_PDF } from '@/lib/config'
import { exportAllTeamSheets, exportTeamSheet } from '@/pdf/lazy'
import { readableError } from '@/lib/supabase'
import { S } from '@/lib/strings'

export function Dashboard() {
  const { profile, canEditTeam } = useAuth()
  const teamsQuery = useTeams()
  const playersQuery = usePlayers()
  usePlayersRealtime(true)
  useTeamsRealtime(true)

  const teams = teamsQuery.data ?? []
  const players = playersQuery.data ?? []
  const loading = teamsQuery.isLoading || playersQuery.isLoading
  const error = teamsQuery.error ?? playersQuery.error

  // "Download all" prints the sheets that are ready. With the gate off that is
  // every team; with it on, only the finalized ones.
  const printable = REQUIRE_FINAL_FOR_PDF ? teams.filter((t) => t.is_final) : teams

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
          disabled={loading || printable.length === 0}
          title={printable.length === 0 ? S.noFinalTeams : undefined}
          onExport={() =>
            exportAllTeamSheets(printable, players, {
              markCaptain: PRINT_CAPTAIN_MARK,
            })
          }
        >
          {REQUIRE_FINAL_FOR_PDF && printable.length > 0
            ? `${S.downloadAll} · ${printable.length}`
            : S.downloadAll}
        </PdfButton>
      </div>

      {!loading && REQUIRE_FINAL_FOR_PDF && printable.length === 0 && (
        <p className="mb-4 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-500">
          {S.noFinalTeams} {S.pdfNeedsFinal}.
        </p>
      )}

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
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {isMine && (
                      <span className="inline-block rounded-full bg-ink px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-white">
                        {S.yourTeam}
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${
                        team.is_final
                          ? 'bg-emerald-600 text-white'
                          : 'bg-neutral-100 text-neutral-500'
                      }`}
                    >
                      {team.is_final && <Lock className="h-3 w-3" />}
                      {team.is_final ? S.final : S.draft}
                    </span>
                  </div>

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
                      disabled={REQUIRE_FINAL_FOR_PDF && !team.is_final}
                      title={
                        REQUIRE_FINAL_FOR_PDF && !team.is_final
                          ? S.pdfNeedsFinal
                          : undefined
                      }
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
