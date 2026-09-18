import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EditableCell } from '@/components/EditableCell'
import { ArrowDown, ArrowUp, Plus, Trash } from '@/components/icons'
import { useToast } from '@/components/Toast'
import { useCustomColumns } from '@/hooks/useCustomColumns'
import {
  useAddPlayer,
  useDeletePlayer,
  useReorderPlayers,
  useUpdatePlayerCustom,
  useUpdatePlayerField,
} from '@/hooks/useTeamData'
import { readableError } from '@/lib/supabase'
import { S } from '@/lib/strings'
import {
  customValue,
  toSheetRows,
  type Player,
  type PlayerField,
  type Team,
} from '@/lib/types'

interface Props {
  team: Team
  players: Player[]
  canEdit: boolean
}

/* The five paper columns keep these proportions on their own. Each custom
   column takes a share of the same 88%, so the sheet columns narrow evenly
   rather than one of them absorbing the whole cost. */
const BASE_PERCENTS = { name: 31, xaalada: 18, joogtaynta: 18, heerka: 21 }
const CUSTOM_PERCENT = 14
const BASE_MIN_WIDTH = 720
const CUSTOM_MIN_WIDTH = 150

export function RosterTable({ team, players, canEdit }: Props) {
  const toast = useToast()
  const columnsQuery = useCustomColumns()
  const updateField = useUpdatePlayerField()
  const updateCustom = useUpdatePlayerCustom()
  const addPlayer = useAddPlayer()
  const deletePlayer = useDeletePlayer()
  const reorderPlayers = useReorderPlayers()

  const [newName, setNewName] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Player | null>(null)
  const [pendingPromote, setPendingPromote] = useState<{
    player: Player
    orderedIds: string[]
  } | null>(null)

  const columns = columnsQuery.data ?? []
  const rows = toSheetRows(players, team.roster_size)
  const isFull = players.length >= team.roster_size
  const addSlot = canEdit && !isFull ? players.length + 1 : null

  // Keep the whole row at 88% + the 52px number column, whatever the count.
  const scale = 88 / (88 + CUSTOM_PERCENT * columns.length)
  const pct = (n: number) => `${(n * scale).toFixed(3)}%`
  const minWidth = BASE_MIN_WIDTH + CUSTOM_MIN_WIDTH * columns.length

  const fail = (error: unknown) => toast(readableError(error), 'error')

  const commitField = (player: Player, field: PlayerField, value: string) => {
    const trimmed = field === 'name' ? value.trim() : value
    if (field === 'name' && trimmed === '') {
      toast(S.namePlaceholder + ' cannot be empty.', 'error')
      return
    }
    updateField.mutate(
      { id: player.id, field, value: trimmed },
      { onError: fail },
    )
  }

  /** Swap a player one slot up or down. Landing on slot 1 changes the captain. */
  const move = (player: Player, direction: -1 | 1) => {
    const ids = players.map((p) => p.id)
    const index = ids.indexOf(player.id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= ids.length) return

    const next = [...ids]
    ;[next[index], next[target]] = [next[target], next[index]]

    if (target === 0) {
      setPendingPromote({ player, orderedIds: next })
      return
    }
    reorderPlayers.mutate({ teamId: team.id, orderedIds: next }, { onError: fail })
  }

  const submitAdd = () => {
    const name = newName.trim()
    if (!name) return
    addPlayer.mutate(
      { teamId: team.id, name },
      {
        onSuccess: () => setNewName(''),
        onError: fail,
      },
    )
  }

  const successor = pendingDelete?.position === 1 ? players[1] : undefined

  return (
    <>
      <div className="overflow-x-auto">
        <table
          className="w-full border-collapse border-l border-t border-black bg-white"
          style={{ minWidth }}
        >
          <colgroup>
            <col style={{ width: 52 }} />
            <col style={{ width: pct(BASE_PERCENTS.name) }} />
            <col style={{ width: pct(BASE_PERCENTS.xaalada) }} />
            <col style={{ width: pct(BASE_PERCENTS.joogtaynta) }} />
            <col style={{ width: pct(BASE_PERCENTS.heerka) }} />
            {columns.map((column) => (
              <col key={column.id} style={{ width: pct(CUSTOM_PERCENT) }} />
            ))}
            {canEdit && <col style={{ width: 104 }} />}
          </colgroup>

          <thead>
            <tr>
              <th className="sheet-cell text-right font-normal">{S.col.no}</th>
              <th className="sheet-cell text-left font-normal">{S.col.name}</th>
              <th className="sheet-cell text-left font-normal">{S.col.xaalada}</th>
              <th className="sheet-cell text-left font-normal">
                {S.col.joogtaynta}
              </th>
              <th className="sheet-cell text-left font-normal">
                {S.col.heerkaKubada}
              </th>
              {columns.map((column) => (
                <th
                  key={column.id}
                  className="sheet-cell text-left font-normal text-neutral-600"
                  title={`${column.label} — screen only, not printed`}
                >
                  {column.label}
                </th>
              ))}
              {canEdit && (
                <th className="sheet-cell text-left font-normal">
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => {
              const player = row.player

              /* ---- a filled slot ------------------------------------- */
              if (player) {
                const isCaptain = row.position === 1
                return (
                  <tr key={player.id} className="align-middle">
                    <td className="sheet-cell text-right tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        {isCaptain && (
                          <span
                            title={S.captain}
                            className="rounded bg-ink px-1 text-[10px] font-bold leading-4 text-white"
                          >
                            {S.captainShort}
                          </span>
                        )}
                        {row.position}
                      </span>
                    </td>
                    <td className="sheet-cell">
                      <EditableCell
                        value={player.name}
                        bold={isCaptain}
                        disabled={!canEdit}
                        ariaLabel={`${S.col.name} ${row.position}`}
                        onCommit={(v) => commitField(player, 'name', v)}
                      />
                    </td>
                    <td className="sheet-cell">
                      <EditableCell
                        value={player.xaalada}
                        disabled={!canEdit}
                        ariaLabel={`${S.col.xaalada} ${row.position}`}
                        onCommit={(v) => commitField(player, 'xaalada', v)}
                      />
                    </td>
                    <td className="sheet-cell">
                      <EditableCell
                        value={player.joogtaynta}
                        disabled={!canEdit}
                        ariaLabel={`${S.col.joogtaynta} ${row.position}`}
                        onCommit={(v) => commitField(player, 'joogtaynta', v)}
                      />
                    </td>
                    <td className="sheet-cell">
                      <EditableCell
                        value={player.heerka_kubada}
                        disabled={!canEdit}
                        ariaLabel={`${S.col.heerkaKubada} ${row.position}`}
                        onCommit={(v) => commitField(player, 'heerka_kubada', v)}
                      />
                    </td>
                    {columns.map((column) => (
                      <td key={column.id} className="sheet-cell">
                        <EditableCell
                          value={customValue(player.custom, column.key)}
                          disabled={!canEdit}
                          ariaLabel={`${column.label} ${row.position}`}
                          onCommit={(v) =>
                            updateCustom.mutate(
                              { id: player.id, key: column.key, value: v },
                              { onError: fail },
                            )
                          }
                        />
                      </td>
                    ))}
                    {canEdit && (
                      <td className="sheet-cell">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="icon-btn"
                            title="Move up"
                            aria-label={`Move ${player.name} up`}
                            disabled={row.position === 1}
                            onClick={() => move(player, -1)}
                          >
                            <ArrowUp />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            title="Move down"
                            aria-label={`Move ${player.name} down`}
                            disabled={row.position === players.length}
                            onClick={() => move(player, 1)}
                          >
                            <ArrowDown />
                          </button>
                          <button
                            type="button"
                            className="icon-btn hover:!border-red-300 hover:!bg-red-50 hover:!text-red-600"
                            title="Remove"
                            aria-label={`Remove ${player.name}`}
                            onClick={() => setPendingDelete(player)}
                          >
                            <Trash />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                )
              }

              /* ---- the next free slot becomes the add row ------------- */
              if (row.position === addSlot) {
                return (
                  <tr key={`add-${row.position}`} className="bg-neutral-50">
                    <td className="sheet-cell text-right tabular-nums text-neutral-400">
                      {row.position}
                    </td>
                    <td className="sheet-cell" colSpan={4 + columns.length}>
                      <div className="flex items-center gap-2">
                        <input
                          className="sheet-input flex-1"
                          value={newName}
                          placeholder={
                            players.length === 0
                              ? `${S.addCaptain} — ${S.namePlaceholder}`
                              : S.namePlaceholder
                          }
                          aria-label={
                            players.length === 0 ? S.addCaptain : S.addPlayer
                          }
                          onChange={(e) => setNewName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitAdd()
                          }}
                        />
                        <button
                          type="button"
                          className="btn-primary !py-1.5 !text-xs"
                          disabled={!newName.trim() || addPlayer.isPending}
                          onClick={submitAdd}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          {players.length === 0 ? S.addCaptain : S.addPlayer}
                        </button>
                      </div>
                    </td>
                    <td className="sheet-cell" />
                  </tr>
                )
              }

              /* ---- an empty printed slot ----------------------------- */
              return (
                <tr key={`empty-${row.position}`}>
                  <td className="sheet-cell text-right tabular-nums text-neutral-400">
                    {row.position}
                  </td>
                  <td className="sheet-cell text-neutral-300">{S.emptySlot}</td>
                  <td className="sheet-cell" />
                  <td className="sheet-cell" />
                  <td className="sheet-cell" />
                  {columns.map((column) => (
                    <td key={column.id} className="sheet-cell" />
                  ))}
                  {canEdit && <td className="sheet-cell" />}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {canEdit && isFull && (
        <p className="mt-3 text-sm text-neutral-500">
          {S.rosterFull} ({players.length}/{team.roster_size}). Increase the roster
          slots to add more.
        </p>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        tone="danger"
        title={S.deletePlayerTitle}
        confirmLabel="Remove"
        body={
          pendingDelete
            ? successor
              ? S.deleteCaptainBody(pendingDelete.name, successor.name)
              : S.deletePlayerBody(pendingDelete.name)
            : ''
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            deletePlayer.mutate(
              { id: pendingDelete.id, teamId: team.id },
              { onError: fail },
            )
          }
          setPendingDelete(null)
        }}
      />

      <ConfirmDialog
        open={pendingPromote !== null}
        title={S.promoteTitle}
        confirmLabel="Make captain"
        body={pendingPromote ? S.promoteBody(pendingPromote.player.name) : ''}
        onCancel={() => setPendingPromote(null)}
        onConfirm={() => {
          if (pendingPromote) {
            reorderPlayers.mutate(
              { teamId: team.id, orderedIds: pendingPromote.orderedIds },
              { onError: fail },
            )
          }
          setPendingPromote(null)
        }}
      />
    </>
  )
}
