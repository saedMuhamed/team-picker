import { useEffect, useMemo } from 'react'
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Player, PlayerField, Profile, Team } from '@/lib/types'

export const TEAMS_KEY = ['teams'] as const
export const PLAYERS_KEY = ['players'] as const
export const PROFILES_KEY = ['profiles'] as const
export const PLAYER_WRITE_KEY = ['player-write'] as const

/* -------------------------------------------------------------------------- */
/* Reads                                                                      */
/* -------------------------------------------------------------------------- */

export function useTeams() {
  return useQuery({
    queryKey: TEAMS_KEY,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('sort_order', { ascending: true })
      if (error) throw error
      return data as Team[]
    },
  })
}

/**
 * Every player, in one cache entry. The whole club is ~60 rows, so a single
 * query keeps the dashboard, the team view and the all-teams PDF from ever
 * disagreeing with each other.
 */
export function usePlayers() {
  return useQuery({
    queryKey: PLAYERS_KEY,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('team_id', { ascending: true })
        .order('position', { ascending: true })
      if (error) throw error
      return data as Player[]
    },
  })
}

/** Players of one team, ordered by position. Position 1 is the captain. */
export function useTeamPlayers(teamId: string | undefined) {
  const query = usePlayers()
  const players = useMemo(() => {
    if (!query.data || !teamId) return []
    return query.data
      .filter((p) => p.team_id === teamId)
      .sort((a, b) => a.position - b.position)
  }, [query.data, teamId])
  return { ...query, players }
}

/** Admin-only: all profiles, for the Access screen. */
export function useProfiles(enabled: boolean) {
  return useQuery({
    queryKey: PROFILES_KEY,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('role', { ascending: true })
        .order('email', { ascending: true })
      if (error) throw error
      return data as Profile[]
    },
  })
}

/** Live roster updates from other people editing at the same time. */
export function usePlayersRealtime(enabled: boolean) {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!enabled) return
    const channel = supabase
      .channel('players-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players' },
        () => {
          void queryClient.invalidateQueries({ queryKey: PLAYERS_KEY })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [enabled, queryClient])
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                     */
/* -------------------------------------------------------------------------- */

function sortPlayers(list: Player[]) {
  return [...list].sort((a, b) =>
    a.team_id === b.team_id
      ? a.position - b.position
      : a.team_id.localeCompare(b.team_id),
  )
}

/** Inline cell edit. Optimistic, rolls back on failure. */
export function useUpdatePlayerField() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: PLAYER_WRITE_KEY,
    mutationFn: async ({
      id,
      field,
      value,
    }: {
      id: string
      field: PlayerField
      value: string
    }) => {
      const { error } = await supabase
        .from('players')
        .update({ [field]: value })
        .eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, field, value }) => {
      await queryClient.cancelQueries({ queryKey: PLAYERS_KEY })
      const previous = queryClient.getQueryData<Player[]>(PLAYERS_KEY)
      queryClient.setQueryData<Player[]>(PLAYERS_KEY, (old) =>
        old?.map((p) => (p.id === id ? { ...p, [field]: value } : p)),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(PLAYERS_KEY, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: PLAYERS_KEY })
    },
  })
}

/** Append a player. The database picks the position and enforces the limit. */
export function useAddPlayer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: PLAYER_WRITE_KEY,
    mutationFn: async ({ teamId, name }: { teamId: string; name: string }) => {
      const { data, error } = await supabase.rpc('add_player', {
        p_team_id: teamId,
        p_name: name,
      })
      if (error) throw error
      return data as Player
    },
    onSuccess: (player) => {
      queryClient.setQueryData<Player[]>(PLAYERS_KEY, (old) =>
        old ? sortPlayers([...old, player]) : old,
      )
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: PLAYERS_KEY })
    },
  })
}

/**
 * Delete and renumber in one transaction. Deleting position 1 promotes
 * position 2 to captain.
 */
export function useDeletePlayer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: PLAYER_WRITE_KEY,
    mutationFn: async ({ id }: { id: string; teamId: string }) => {
      const { error } = await supabase.rpc('delete_player', { p_id: id })
      if (error) throw error
    },
    onMutate: async ({ id, teamId }) => {
      await queryClient.cancelQueries({ queryKey: PLAYERS_KEY })
      const previous = queryClient.getQueryData<Player[]>(PLAYERS_KEY)
      queryClient.setQueryData<Player[]>(PLAYERS_KEY, (old) => {
        if (!old) return old
        const remaining = old.filter((p) => p.id !== id)
        let next = 0
        return sortPlayers(
          remaining.map((p) =>
            p.team_id === teamId ? { ...p, position: ++next } : p,
          ),
        )
      })
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(PLAYERS_KEY, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: PLAYERS_KEY })
    },
  })
}

/**
 * Renumber a team to the given order, atomically. Whoever ends up at
 * position 1 becomes the captain.
 */
export function useReorderPlayers() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: PLAYER_WRITE_KEY,
    mutationFn: async ({
      teamId,
      orderedIds,
    }: {
      teamId: string
      orderedIds: string[]
    }) => {
      const { error } = await supabase.rpc('reorder_players', {
        p_team_id: teamId,
        p_ordered_ids: orderedIds,
      })
      if (error) throw error
    },
    onMutate: async ({ teamId, orderedIds }) => {
      await queryClient.cancelQueries({ queryKey: PLAYERS_KEY })
      const previous = queryClient.getQueryData<Player[]>(PLAYERS_KEY)
      queryClient.setQueryData<Player[]>(PLAYERS_KEY, (old) => {
        if (!old) return old
        const rank = new Map(orderedIds.map((id, i) => [id, i + 1]))
        return sortPlayers(
          old.map((p) =>
            p.team_id === teamId && rank.has(p.id)
              ? { ...p, position: rank.get(p.id)! }
              : p,
          ),
        )
      })
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(PLAYERS_KEY, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: PLAYERS_KEY })
    },
  })
}

/** Admin-only: number of printed slots on a team's sheet. */
export function useUpdateRosterSize() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ teamId, size }: { teamId: string; size: number }) => {
      const { error } = await supabase
        .from('teams')
        .update({ roster_size: size })
        .eq('id', teamId)
      if (error) throw error
    },
    onMutate: async ({ teamId, size }) => {
      await queryClient.cancelQueries({ queryKey: TEAMS_KEY })
      const previous = queryClient.getQueryData<Team[]>(TEAMS_KEY)
      queryClient.setQueryData<Team[]>(TEAMS_KEY, (old) =>
        old?.map((t) => (t.id === teamId ? { ...t, roster_size: size } : t)),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(TEAMS_KEY, context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: TEAMS_KEY })
    },
  })
}

/** Admin-only: grant or revoke a captain's edit rights. */
export function useSetCanEdit() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, canEdit }: { id: string; canEdit: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ can_edit: canEdit })
        .eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, canEdit }) => {
      await queryClient.cancelQueries({ queryKey: PROFILES_KEY })
      const previous = queryClient.getQueryData<Profile[]>(PROFILES_KEY)
      queryClient.setQueryData<Profile[]>(PROFILES_KEY, (old) =>
        old?.map((p) => (p.id === id ? { ...p, can_edit: canEdit } : p)),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(PROFILES_KEY, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: PROFILES_KEY })
    },
  })
}

/** Admin-only: point a captain at a team. */
export function useAssignTeam() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, teamId }: { id: string; teamId: string | null }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ team_id: teamId })
        .eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, teamId }) => {
      await queryClient.cancelQueries({ queryKey: PROFILES_KEY })
      const previous = queryClient.getQueryData<Profile[]>(PROFILES_KEY)
      queryClient.setQueryData<Profile[]>(PROFILES_KEY, (old) =>
        old?.map((p) => (p.id === id ? { ...p, team_id: teamId } : p)),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(PROFILES_KEY, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: PROFILES_KEY })
    },
  })
}

/** How many roster writes are in flight — drives the Saving…/Saved chip. */
export function usePendingWrites() {
  return useIsMutating({ mutationKey: PLAYER_WRITE_KEY })
}
