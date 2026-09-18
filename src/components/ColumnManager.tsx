import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Pencil, Plus, Trash } from '@/components/icons'
import { useToast } from '@/components/Toast'
import {
  useAddCustomColumn,
  useCustomColumns,
  useDeleteCustomColumn,
  useRenameCustomColumn,
} from '@/hooks/useCustomColumns'
import { readableError } from '@/lib/supabase'
import { S } from '@/lib/strings'
import type { CustomColumn } from '@/lib/types'

/**
 * Add, rename and remove the extra columns. Admin only — the RPCs refuse
 * everyone else, so this is a convenience, not the control.
 *
 * Collapsed by default: most visits to a team page are not about columns, and
 * an always-open editor above the roster competes with it for attention.
 */
export function ColumnManager() {
  const toast = useToast()
  const columnsQuery = useCustomColumns()
  const addColumn = useAddCustomColumn()
  const renameColumn = useRenameCustomColumn()
  const deleteColumn = useDeleteCustomColumn()

  const [open, setOpen] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [editing, setEditing] = useState<CustomColumn | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [pendingDelete, setPendingDelete] = useState<CustomColumn | null>(null)

  const columns = columnsQuery.data ?? []
  const fail = (error: unknown) => toast(readableError(error), 'error')

  const submitAdd = () => {
    const label = newLabel.trim()
    if (!label) return
    addColumn.mutate(
      { label },
      { onSuccess: () => setNewLabel(''), onError: fail },
    )
  }

  const submitRename = () => {
    if (!editing) return
    const label = editLabel.trim()
    if (!label || label === editing.label) {
      setEditing(null)
      return
    }
    renameColumn.mutate({ id: editing.id, label }, { onError: fail })
    setEditing(null)
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
      >
        {S.columns}
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs tabular-nums text-neutral-500">
          {columns.length}
        </span>
        <span className="ml-auto text-xs font-normal text-neutral-400">
          {open ? 'Hide' : 'Manage'}
        </span>
      </button>

      {open && (
        <div className="border-t border-neutral-200 p-4">
          <p className="mb-3 text-xs text-neutral-500">{S.columnsSubtitle}</p>

          {columns.length === 0 && (
            <p className="mb-3 text-sm text-neutral-400">{S.noColumns}</p>
          )}

          <ul className="mb-3 space-y-1.5">
            {columns.map((column) => (
              <li
                key={column.id}
                className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-1.5"
              >
                {editing?.id === column.id ? (
                  <input
                    autoFocus
                    className="flex-1 rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-ink"
                    value={editLabel}
                    aria-label={`${S.renameColumn} ${column.label}`}
                    onChange={(e) => setEditLabel(e.target.value)}
                    onBlur={submitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                      if (e.key === 'Escape') setEditing(null)
                    }}
                  />
                ) : (
                  <span className="flex-1 truncate text-sm">{column.label}</span>
                )}

                <button
                  type="button"
                  className="icon-btn"
                  title={S.renameColumn}
                  aria-label={`${S.renameColumn} ${column.label}`}
                  onClick={() => {
                    setEditing(column)
                    setEditLabel(column.label)
                  }}
                >
                  <Pencil />
                </button>
                <button
                  type="button"
                  className="icon-btn hover:!border-red-300 hover:!bg-red-50 hover:!text-red-600"
                  title={S.removeColumn}
                  aria-label={`${S.removeColumn} ${column.label}`}
                  onClick={() => setPendingDelete(column)}
                >
                  <Trash />
                </button>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <input
              className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-ink"
              placeholder={S.columnName}
              aria-label={S.addColumn}
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitAdd()
              }}
            />
            <button
              type="button"
              className="btn-primary !py-1.5 !text-xs"
              disabled={!newLabel.trim() || addColumn.isPending}
              onClick={submitAdd}
            >
              <Plus className="h-3.5 w-3.5" />
              {S.addColumn}
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        tone="danger"
        title={S.removeColumnTitle}
        confirmLabel={S.removeColumn}
        body={pendingDelete ? S.removeColumnBody(pendingDelete.label) : ''}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) {
            deleteColumn.mutate({ id: pendingDelete.id }, { onError: fail })
          }
          setPendingDelete(null)
        }}
      />
    </div>
  )
}
