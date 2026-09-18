import { useToast } from '@/components/Toast'
import { Skeleton } from '@/components/Skeleton'
import {
  useAssignTeam,
  useProfiles,
  useSetCanEdit,
  useTeams,
} from '@/hooks/useTeamData'
import { toDisplayName } from '@/lib/config'
import { readableError } from '@/lib/supabase'
import { S } from '@/lib/strings'

export function Access() {
  const toast = useToast()
  const teamsQuery = useTeams()
  const profilesQuery = useProfiles(true)
  const setCanEdit = useSetCanEdit()
  const assignTeam = useAssignTeam()

  const teams = teamsQuery.data ?? []
  const captains = (profilesQuery.data ?? []).filter((p) => p.role === 'captain')
  const fail = (error: unknown) => toast(readableError(error), 'error')

  return (
    <div>
      <h1 className="text-xl font-semibold">{S.access}</h1>
      <p className="mt-1 text-sm text-neutral-500">{S.accessSubtitle}</p>

      <div className="mt-5 overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {profilesQuery.isLoading && (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        )}

        {!profilesQuery.isLoading && captains.length === 0 && (
          <p className="p-6 text-center text-sm text-neutral-500">
            No captain accounts yet. Create them in the Supabase dashboard under
            Authentication → Users.
          </p>
        )}

        {!profilesQuery.isLoading && captains.length > 0 && (
          <ul className="divide-y divide-neutral-200">
            {captains.map((captain) => {
              const team = teams.find((t) => t.id === captain.team_id)
              return (
                <li
                  key={captain.id}
                  className="flex flex-wrap items-center gap-3 p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {captain.full_name || toDisplayName(captain.email)}
                    </p>
                    {/* Captains sign in with a username; the synthetic
                        @teampicker.local address is noise on screen. */}
                    <p className="truncate text-xs text-neutral-500">
                      {toDisplayName(captain.email)}
                    </p>
                    {!captain.team_id && (
                      <p className="mt-1 text-xs text-amber-600">
                        {S.unassignedHint}
                      </p>
                    )}
                  </div>

                  <label className="flex items-center gap-2 text-sm">
                    <span className="sr-only">{S.assignedTeam}</span>
                    <span
                      className="inline-block h-4 w-4 rounded border border-black"
                      style={{ backgroundColor: team?.color_hex ?? '#ffffff' }}
                      aria-hidden
                    />
                    <select
                      className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
                      value={captain.team_id ?? ''}
                      onChange={(e) =>
                        assignTeam.mutate(
                          { id: captain.id, teamId: e.target.value || null },
                          { onError: fail },
                        )
                      }
                    >
                      <option value="">{S.noTeam}</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.display_name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-emerald-600"
                      checked={captain.can_edit}
                      disabled={!captain.team_id}
                      onChange={(e) =>
                        setCanEdit.mutate(
                          { id: captain.id, canEdit: e.target.checked },
                          { onError: fail },
                        )
                      }
                    />
                    <span
                      className={
                        captain.can_edit ? 'font-medium text-emerald-700' : ''
                      }
                    >
                      {S.canEdit}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <p className="mt-4 text-xs text-neutral-400">
        Turning off {S.canEdit} is enforced by the database, not just by hiding
        buttons — a captain without it cannot write to the roster by any route.
      </p>
    </div>
  )
}
