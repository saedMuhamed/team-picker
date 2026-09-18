import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { ColumnManager } from '@/components/ColumnManager'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { HeaderBand } from '@/components/HeaderBand'
import { ChevronLeft, Lock, Unlock } from '@/components/icons'
import { PdfButton } from '@/components/PdfButton'
import { RosterTable } from '@/components/RosterTable'
import { RosterSkeleton } from '@/components/Skeleton'
import { useToast } from '@/components/Toast'
import { useCustomColumnsRealtime } from '@/hooks/useCustomColumns'
import {
  useFinalizeTeam,
  usePendingWrites,
  usePlayers,
  usePlayersRealtime,
  useTeamPlayers,
  useTeams,
  useTeamsRealtime,
  useUpdateRosterSize,
} from '@/hooks/useTeamData'
import { PRINT_CAPTAIN_MARK, REQUIRE_FINAL_FOR_PDF } from '@/lib/config'
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
  useTeamsRealtime(true)
  useCustomColumnsRealtime(true)

  const team = teamsQuery.data?.find((t) => t.slug === slug)
  const { players } = useTeamPlayers(team?.id)
  const pendingWrites = usePendingWrites()
  const updateRosterSize = useUpdateRosterSize()
  const finalizeTeam = useFinalizeTeam()

  const [pendingFinal, setPendingFinal] = useState<boolean | null>(null)

  const isFinal = team?.is_final ?? false
  // Mirrors can_edit_team() in the database, which also refuses a final team.
  const canEdit = canEditTeam(team?.id) && !isFinal
  const canPrint = !REQUIRE_FINAL_FOR_PDF || isFinal
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

      {isFinal && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <Lock className="h-4 w-4 shrink-0" />
          <span>
            <strong className="font-semibold">{S.finalTeam}.</strong>{' '}
            {team.finalized_at
              ? S.finalizedOn(new Date(team.finalized_at).toLocaleDateString())
              : ''}{' '}
            {isAdmin ? S.lockedHint : 'Ask the admin to reopen it to make changes.'}
          </span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            isFinal
              ? 'bg-emerald-600 text-white'
              : canEdit
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-neutral-200 text-neutral-600'
          }`}
        >
          {isFinal ? S.final : canEdit ? S.editing : S.viewOnly}
        </span>

        {canEdit && (
          <span className="text-xs text-neutral-500" aria-live="polite">
            {pendingWrites > 0 ? S.saving : S.saved}
          </span>
        )}

        {isAdmin && !isFinal && (
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

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              className="btn-ghost"
              disabled={finalizeTeam.isPending}
              onClick={() => setPendingFinal(!isFinal)}
            >
              {isFinal ? (
                <Unlock className="h-4 w-4" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              {isFinal ? S.unfinalize : S.finalize}
            </button>
          )}

          <PdfButton
            variant="primary"
            disabled={!canPrint}
            title={canPrint ? undefined : S.pdfNeedsFinal}
            onExport={() =>
              exportTeamSheet(team, players, { markCaptain: PRINT_CAPTAIN_MARK })
            }
          >
            {S.downloadPdf}
          </PdfButton>
        </div>
      </div>

      {!canPrint && (
        <p className="mt-2 text-xs text-neutral-500">{S.pdfNeedsFinal}.</p>
      )}

      {isAdmin && (
        <div className="mt-4">
          <ColumnManager />
        </div>
      )}

      <div className="mt-4">
        <RosterTable team={team} players={players} canEdit={canEdit} />
      </div>

      {!canEdit && !isFinal && (
        <p className="mt-4 text-sm text-neutral-500">
          You can view and export this sheet. Ask the admin to turn on editing if
          you need to change it.
        </p>
      )}

      <ConfirmDialog
        open={pendingFinal !== null}
        title={pendingFinal ? S.finalizeTitle : S.unfinalizeTitle}
        confirmLabel={pendingFinal ? S.finalize : S.unfinalize}
        body={
          pendingFinal === null
            ? ''
            : pendingFinal
              ? S.finalizeBody(team.display_name, players.length)
              : S.unfinalizeBody(team.display_name)
        }
        onCancel={() => setPendingFinal(null)}
        onConfirm={() => {
          if (pendingFinal !== null) {
            finalizeTeam.mutate(
              { teamId: team.id, final: pendingFinal },
              { onError: (err) => toast(readableError(err), 'error') },
            )
          }
          setPendingFinal(null)
        }}
      />
    </div>
  )
}
