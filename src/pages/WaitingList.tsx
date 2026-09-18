import { useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { ColumnManager } from '@/components/ColumnManager'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EditableCell } from '@/components/EditableCell'
import { Plus, Trash } from '@/components/icons'
import { RosterSkeleton } from '@/components/Skeleton'
import { useToast } from '@/components/Toast'
import {
  useCustomColumns,
  useCustomColumnsRealtime,
} from '@/hooks/useCustomColumns'
import { usePlayers, useTeams, useTeamsRealtime } from '@/hooks/useTeamData'
import {
  useAddWaitingPlayer,
  useDeleteWaitingPlayer,
  usePromoteWaitingPlayer,
  useUpdateWaitingCustom,
  useUpdateWaitingField,
  useWaitingList,
  useWaitingListRealtime,
  useWaitingPendingWrites,
} from '@/hooks/useWaitingList'
import { readableError } from '@/lib/supabase'
import { S } from '@/lib/strings'
import {
  customValue,
  PLAYER_LEVELS,
  type PlayerLevel,
  type WaitingPlayer,
} from '@/lib/types'

const LEVEL_STYLE: Record<PlayerLevel, string> = {
  beginner: 'bg-neutral-100 text-neutral-700',
  intermediate: 'bg-sky-100 text-sky-800',
  advanced: 'bg-violet-100 text-violet-800',
  pro: 'bg-amber-100 text-amber-900',
}

export function WaitingList() {
  const { isAdmin } = useAuth()
  const toast = useToast()

  const waitingQuery = useWaitingList()
  const teamsQuery = useTeams()
  const playersQuery = usePlayers()
  const columnsQuery = useCustomColumns()
  useWaitingListRealtime(true)
  useCustomColumnsRealtime(true)
  useTeamsRealtime(true)

  const addWaiting = useAddWaitingPlayer()
  const updateField = useUpdateWaitingField()
  const updateCustom = useUpdateWaitingCustom()
  const deleteWaiting = useDeleteWaitingPlayer()
  const promote = usePromoteWaitingPlayer()
  const pendingWrites = useWaitingPendingWrites()

  const [newName, setNewName] = useState('')
  const [pendingDelete, setPendingDelete] = useState<WaitingPlayer | null>(null)

  const waiting = waitingQuery.data ?? []
  const teams = teamsQuery.data ?? []
  const players = playersQuery.data ?? []
  const columns = columnsQuery.data ?? []
  const loading = waitingQuery.isLoading || teamsQuery.isLoading

  const fail = (error: unknown) => toast(readableError(error), 'error')

  const submitAdd = () => {
    const name = newName.trim()
    if (!name) return
    addWaiting.mutate(
      { name },
      { onSuccess: () => setNewName(''), onError: fail },
    )
  }

  const assign = (entry: WaitingPlayer, teamId: string) => {
    const team = teams.find((t) => t.id === teamId)
    promote.mutate(
      { id: entry.id, teamId },
      {
        onSuccess: () =>
          toast(S.assignedOk(entry.name, team?.display_name ?? 'the team')),
        onError: fail,
      },
    )
  }

  /** A team can take someone only while it is open and has a free slot. */
  const teamHasRoom = (teamId: string, rosterSize: number) =>
    players.filter((p) => p.team_id === teamId).length < rosterSize

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-14 animate-pulse rounded bg-neutral-200" />
        <RosterSkeleton />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">{S.waitingList}</h1>
        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs tabular-nums text-neutral-600">
          {waiting.length}
        </span>
        {isAdmin && (
          <span className="text-xs text-neutral-500" aria-live="polite">
            {pendingWrites > 0 ? S.saving : S.saved}
          </span>
        )}
      </div>
      <p className="mb-4 text-sm text-neutral-500">{S.waitingSubtitle}</p>

      {isAdmin && (
        <div className="mb-4">
          <ColumnManager />
        </div>
      )}

      {waiting.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-sm text-neutral-400">
          {S.waitingEmpty}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table
            className="w-full border-collapse border-l border-t border-black bg-white"
            style={{ minWidth: 640 + 150 * columns.length }}
          >
            <colgroup>
              <col style={{ width: 44 }} />
              <col style={{ width: '36%' }} />
              <col style={{ width: '20%' }} />
              <col style={{ width: '20%' }} />
              {columns.map((column) => (
                <col key={column.id} style={{ width: '14%' }} />
              ))}
              {isAdmin && <col style={{ width: 190 }} />}
            </colgroup>

            <thead>
              <tr>
                <th className="sheet-cell text-right font-normal">{S.col.no}</th>
                <th className="sheet-cell text-left font-normal">{S.col.name}</th>
                <th className="sheet-cell text-left font-normal">Position</th>
                <th className="sheet-cell text-left font-normal">{S.level}</th>
                {columns.map((column) => (
                  <th
                    key={column.id}
                    className="sheet-cell text-left font-normal text-neutral-600"
                  >
                    {column.label}
                  </th>
                ))}
                {isAdmin && (
                  <th className="sheet-cell text-left font-normal">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {waiting.map((entry, index) => (
                <tr key={entry.id} className="align-middle">
                  <td className="sheet-cell text-right tabular-nums text-neutral-500">
                    {index + 1}
                  </td>

                  <td className="sheet-cell">
                    <EditableCell
                      value={entry.name}
                      disabled={!isAdmin}
                      ariaLabel={`${S.col.name} ${index + 1}`}
                      onCommit={(v) => {
                        const name = v.trim()
                        if (!name) {
                          toast(`${S.namePlaceholder} cannot be empty.`, 'error')
                          return
                        }
                        updateField.mutate(
                          { id: entry.id, field: 'name', value: name },
                          { onError: fail },
                        )
                      }}
                    />
                  </td>

                  <td className="sheet-cell">
                    <EditableCell
                      value={entry.playing_position}
                      disabled={!isAdmin}
                      placeholder="GK, DF, MF, FW"
                      ariaLabel={`Position ${index + 1}`}
                      onCommit={(v) =>
                        updateField.mutate(
                          { id: entry.id, field: 'playing_position', value: v },
                          { onError: fail },
                        )
                      }
                    />
                  </td>

                  <td className="sheet-cell">
                    {isAdmin ? (
                      <select
                        className="sheet-input"
                        value={entry.level}
                        aria-label={`${S.level} ${index + 1}`}
                        onChange={(e) =>
                          updateField.mutate(
                            {
                              id: entry.id,
                              field: 'level',
                              value: e.target.value,
                            },
                            { onError: fail },
                          )
                        }
                      >
                        {PLAYER_LEVELS.map((level) => (
                          <option key={level} value={level}>
                            {S.levelLabel[level]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${LEVEL_STYLE[entry.level]}`}
                      >
                        {S.levelLabel[entry.level]}
                      </span>
                    )}
                  </td>

                  {columns.map((column) => (
                    <td key={column.id} className="sheet-cell">
                      <EditableCell
                        value={customValue(entry.custom, column.key)}
                        disabled={!isAdmin}
                        ariaLabel={`${column.label} ${index + 1}`}
                        onCommit={(v) =>
                          updateCustom.mutate(
                            { id: entry.id, key: column.key, value: v },
                            { onError: fail },
                          )
                        }
                      />
                    </td>
                  ))}

                  {isAdmin && (
                    <td className="sheet-cell">
                      <div className="flex items-center gap-1">
                        <select
                          className="sheet-input flex-1"
                          value=""
                          aria-label={`${S.assignTo} — ${entry.name}`}
                          disabled={promote.isPending}
                          onChange={(e) => {
                            if (e.target.value) assign(entry, e.target.value)
                            e.target.value = ''
                          }}
                        >
                          <option value="">{S.assignTo}</option>
                          {teams.map((team) => {
                            const room = teamHasRoom(team.id, team.roster_size)
                            return (
                              <option
                                key={team.id}
                                value={team.id}
                                disabled={team.is_final || !room}
                              >
                                {team.display_name}
                                {team.is_final
                                  ? ` (${S.final})`
                                  : room
                                    ? ''
                                    : ' (full)'}
                              </option>
                            )
                          })}
                        </select>
                        <button
                          type="button"
                          className="icon-btn hover:!border-red-300 hover:!bg-red-50 hover:!text-red-600"
                          title="Remove from waiting list"
                          aria-label={`Remove ${entry.name}`}
                          onClick={() => setPendingDelete(entry)}
                        >
                          <Trash />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isAdmin && (
        <div className="mt-4 flex items-center gap-2">
          <input
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-ink sm:max-w-xs"
            placeholder={S.namePlaceholder}
            aria-label={S.addToWaiting}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitAdd()
            }}
          />
          <button
            type="button"
            className="btn-primary"
            disabled={!newName.trim() || addWaiting.isPending}
            onClick={submitAdd}
          >
            <Plus className="h-4 w-4" />
            {S.addToWaiting}
          </button>
        </div>
      )}

      {!isAdmin && waiting.length > 0 && (
        <p className="mt-4 text-sm text-neutral-500">
          Only the admin can change the waiting list.
        </p>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        tone="danger"
        title={S.removeWaitingTitle}
        confirmLabel="Remove"
        body={pendingDelete ? S.removeWaitingBody(pendingDelete.name) : ''}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            deleteWaiting.mutate({ id: pendingDelete.id }, { onError: fail })
          }
          setPendingDelete(null)
        }}
      />
    </div>
  )
}
