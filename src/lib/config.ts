/**
 * Print the captain's name in bold with a trailing "(C)" on the PDF.
 * Set to false for sheets identical to the original paper version.
 */
export const PRINT_CAPTAIN_MARK = true

/**
 * Supabase Auth identifies people by email, but the captains sign in with a
 * bare username. Anything typed without an "@" gets this appended, so
 * `xatto` reaches Supabase as `xatto@teampicker.local`.
 *
 * Changing this after the accounts exist locks everyone out — the stored
 * emails would no longer match. Change `supabase/users.sql` too, and re-run it.
 */
export const USERNAME_DOMAIN = 'teampicker.local'

/**
 * Require a team to be finalized before its sheet can be exported.
 * Set to false to allow printing a draft roster at any time.
 */
export const REQUIRE_FINAL_FOR_PDF = true

/** Turn a username or an email into the email Supabase Auth expects. */
export function toLoginEmail(input: string): string {
  const trimmed = input.trim()
  return trimmed.includes('@')
    ? trimmed.toLowerCase()
    : `${trimmed.toLowerCase()}@${USERNAME_DOMAIN}`
}

/** The inverse, for display: hides the synthetic domain, keeps real emails. */
export function toDisplayName(email: string | null | undefined): string {
  if (!email) return ''
  return email.endsWith(`@${USERNAME_DOMAIN}`)
    ? email.slice(0, -`@${USERNAME_DOMAIN}`.length)
    : email
}
