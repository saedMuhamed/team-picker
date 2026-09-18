import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { CustomColumn } from '@/lib/types'

export const COLUMNS_KEY = ['custom-columns'] as const

/**
 * The admin-defined columns, shared by every roster and the waiting list.
 * Rarely changes, so it is cached generously and refreshed over realtime.
 */
export function useCustomColumns() {
  return useQuery({
    queryKey: COLUMNS_KEY,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_columns')
        .select('*')
        .order('sort_order', { ascending: true })
      if (error) throw error
      return data as CustomColumn[]
    },
  })
}

/** Live column changes, so a second screen doesn't render a stale header row. */
export function useCustomColumnsRealtime(enabled: boolean) {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!enabled) return
    const channel = supabase
      .channel('custom-columns-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'custom_columns' },
        () => {
          void queryClient.invalidateQueries({ queryKey: COLUMNS_KEY })
        },
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [enabled, queryClient])
}

/* -------------------------------------------------------------------------- */
/* Writes — admin only, enforced by the RPCs themselves                       */
/* -------------------------------------------------------------------------- */

export function useAddCustomColumn() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ label }: { label: string }) => {
      const { data, error } = await supabase.rpc('add_custom_column', {
        p_label: label,
      })
      if (error) throw error
      return data as CustomColumn
    },
    onSuccess: (column) => {
      queryClient.setQueryData<CustomColumn[]>(COLUMNS_KEY, (old) =>
        old ? [...old, column].sort((a, b) => a.sort_order - b.sort_order) : old,
      )
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: COLUMNS_KEY })
    },
  })
}

/**
 * Only the label moves. The key the values are stored under is fixed at
 * creation, so a rename never touches a single row of data.
 */
export function useRenameCustomColumn() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, label }: { id: string; label: string }) => {
      const { error } = await supabase.rpc('rename_custom_column', {
        p_id: id,
        p_label: label,
      })
      if (error) throw error
    },
    onMutate: async ({ id, label }) => {
      await queryClient.cancelQueries({ queryKey: COLUMNS_KEY })
      const previous = queryClient.getQueryData<CustomColumn[]>(COLUMNS_KEY)
      queryClient.setQueryData<CustomColumn[]>(COLUMNS_KEY, (old) =>
        old?.map((c) => (c.id === id ? { ...c, label } : c)),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(COLUMNS_KEY, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: COLUMNS_KEY })
    },
  })
}

/**
 * Drops the column and every value stored under it. The rosters and the
 * waiting list both hold those values, so both caches are invalidated.
 */
export function useDeleteCustomColumn() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.rpc('delete_custom_column', { p_id: id })
      if (error) throw error
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: COLUMNS_KEY })
      const previous = queryClient.getQueryData<CustomColumn[]>(COLUMNS_KEY)
      queryClient.setQueryData<CustomColumn[]>(COLUMNS_KEY, (old) =>
        old?.filter((c) => c.id !== id),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(COLUMNS_KEY, context.previous)
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: COLUMNS_KEY })
      void queryClient.invalidateQueries({ queryKey: ['players'] })
      void queryClient.invalidateQueries({ queryKey: ['waiting-list'] })
    },
  })
}
