import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * False when .env has not been filled in yet. The app shows a setup screen
 * instead of a blank page, which is friendlier than throwing at import time.
 */
export const isSupabaseConfigured =
  Boolean(url) && Boolean(anonKey) && !url.includes('your-project-ref')

export const supabase = createClient(
  isSupabaseConfigured ? url : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? anonKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
)

/** Turns a Postgres/PostgREST error into something worth showing a human. */
export function readableError(error: unknown): string {
  const raw =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Something went wrong'

  const known: Record<string, string> = {
    not_authorized: 'You do not have permission to edit this team.',
    roster_full: 'This team is already full. Increase the roster size first.',
    name_required: 'A name is required.',
    team_not_found: 'That team no longer exists.',
    player_not_found: 'That player has already been removed.',
    ordering_mismatch: 'The roster changed while you were reordering. Reloading.',
    roster_empty: 'Add at least one player before finalizing this team.',
    label_required: 'A column name is required.',
    column_not_found: 'That column has already been removed.',
    waiting_not_found: 'That player is no longer on the waiting list.',
    'Invalid login credentials': 'Wrong username or password.',
  }

  for (const [needle, message] of Object.entries(known)) {
    if (raw.includes(needle)) return message
  }

  if (raw.includes('violates row-level security')) {
    return 'You do not have permission to do that.'
  }

  return raw
}
