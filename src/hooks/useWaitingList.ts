import { useEffect } from 'react'
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PLAYERS_KEY } from '@/hooks/useTeamData'
import type { Player, WaitingField, WaitingPlayer } from '@/lib/types'

export const WAITING_KEY = ['waiting-list'] as const
export const WAITING_WRITE_KEY = ['waiting-write'] as const

/** The whole pool, oldest first — the order people joined the list. */
export function useWaitingList() {
  return useQuery({
    queryKey: WAITING_KEY,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('waiting_list')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as WaitingPlayer[]
    },
  })
}

export function useWaitingListRealtime(enabled: boolean) {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!enabled) return
    const channel = supabase
      .channel('waiting-list-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waiting_list' },
        () => {
          void queryClient.invalidateQueries({ queryKey: WAITING_KEY })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [enabled, queryClient])
}

/* -------------------------------------------------------------------------- */
/* Writes — admin only, enforced by RLS                                       */
/* -------------------------------------------------------------------------- */

export function useAddWaitingPlayer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: WAITING_WRITE_KEY,
    mutationFn: async ({ name }: { name: string }) => {
      const { data, error } = await supabase
        .from('waiting_list')
        .insert({ name: name.trim() })
        .select()
        .single()
      if (error) throw error
      return data as WaitingPlayer
    },
    onSuccess: (entry) => {
      queryClient.setQueryData<WaitingPlayer[]>(WAITING_KEY, (old) =>
        old ? [...old, entry] : old,
      )
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: WAITING_KEY })
    },
  })
}

/** Inline edit of one built-in field. Optimistic, rolls back on failure. */
export function useUpdateWaitingField() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: WAITING_WRITE_KEY,
    mutationFn: async ({
      id,
      field,
      value,
    }: {
      id: string
      field: WaitingField
      value: string | number | null
    }) => {
      const { error } = await supabase
        .from('waiting_list')
        .update({ [field]: value })
        .eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, field, value }) => {
      await queryClient.cancelQueries({ queryKey: WAITING_KEY })
      const previous = queryClient.getQueryData<WaitingPlayer[]>(WAITING_KEY)
      queryClient.setQueryData<WaitingPlayer[]>(WAITING_KEY, (old) =>
        old?.map((w) => (w.id === id ? { ...w, [field]: value } : w)),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(WAITING_KEY, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: WAITING_KEY })
    },
  })
}

/** Inline edit of one custom column's value. */
export function useUpdateWaitingCustom() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: WAITING_WRITE_KEY,
    mutationFn: async ({
      id,
      key,
      value,
    }: {
      id: string
      key: string
      value: string
    }) => {
      const { error } = await supabase.rpc('set_waiting_custom', {
        p_waiting_id: id,
        p_key: key,
        p_value: value,
      })
      if (error) throw error
    },
    onMutate: async ({ id, key, value }) => {
      await queryClient.cancelQueries({ queryKey: WAITING_KEY })
      const previous = queryClient.getQueryData<WaitingPlayer[]>(WAITING_KEY)
      queryClient.setQueryData<WaitingPlayer[]>(WAITING_KEY, (old) =>
        old?.map((w) =>
          w.id === id ? { ...w, custom: { ...w.custom, [key]: value } } : w,
        ),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(WAITING_KEY, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: WAITING_KEY })
    },
  })
}

export function useDeleteWaitingPlayer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: WAITING_WRITE_KEY,
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.from('waiting_list').delete().eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: WAITING_KEY })
      const previous = queryClient.getQueryData<WaitingPlayer[]>(WAITING_KEY)
      queryClient.setQueryData<WaitingPlayer[]>(WAITING_KEY, (old) =>
        old?.filter((w) => w.id !== id),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(WAITING_KEY, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: WAITING_KEY })
    },
  })
}

/**
 * Move an entry onto a team's roster. The RPC delegates to add_player(), so a
 * full roster or a finalized team refuses this the same way a manual add does,
 * and the pool entry is only dropped once the player has landed.
 */
export function usePromoteWaitingPlayer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: WAITING_WRITE_KEY,
    mutationFn: async ({ id, teamId }: { id: string; teamId: string }) => {
      const { data, error } = await supabase.rpc('promote_waiting_player', {
        p_waiting_id: id,
        p_team_id: teamId,
      })
      if (error) throw error
      return data as Player
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: WAITING_KEY })
      void queryClient.invalidateQueries({ queryKey: PLAYERS_KEY })
    },
  })
}

/** How many waiting list writes are in flight — drives the Saving…/Saved chip. */
export function useWaitingPendingWrites() {
  return useIsMutating({ mutationKey: WAITING_WRITE_KEY })
}
