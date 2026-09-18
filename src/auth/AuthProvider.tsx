import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

interface AuthValue {
  session: Session | null
  profile: Profile | null
  /** True until we know whether there is a session and, if so, who it belongs to. */
  loading: boolean
  isAdmin: boolean
  /** Mirrors the database's can_edit_team() so the UI and RLS agree. */
  canEditTeam: (teamId: string | null | undefined) => boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => void
}

const AuthContext = createContext<AuthValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [initializing, setInitializing] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    let active = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return
        setSession(data.session)
      })
      .finally(() => {
        if (active) setInitializing(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Only touch state here — calling back into supabase from this callback
      // can deadlock the auth client.
      setSession(nextSession)
      if (!nextSession) queryClient.clear()
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [queryClient])

  const userId = session?.user.id

  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    // Refetches on focus, so an admin flipping `can_edit` reaches the captain
    // as soon as they come back to the tab.
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId!)
        .maybeSingle()
      if (error) throw error
      return (data as Profile | null) ?? null
    },
  })

  const profile = profileQuery.data ?? null

  const canEditTeam = useCallback(
    (teamId: string | null | undefined) => {
      if (!profile) return false
      if (profile.role === 'admin') return true
      return Boolean(
        profile.can_edit && teamId && profile.team_id === teamId,
      )
    },
    [profile],
  )

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    queryClient.clear()
  }, [queryClient])

  const refreshProfile = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['profile'] })
  }, [queryClient])

  const value = useMemo<AuthValue>(
    () => ({
      session,
      profile,
      loading: initializing || (Boolean(userId) && profileQuery.isLoading),
      isAdmin: profile?.role === 'admin',
      canEditTeam,
      signIn,
      signOut,
      refreshProfile,
    }),
    [
      session,
      profile,
      initializing,
      userId,
      profileQuery.isLoading,
      canEditTeam,
      signIn,
      signOut,
      refreshProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
