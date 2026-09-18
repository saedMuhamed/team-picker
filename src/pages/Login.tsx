import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { readableError } from '@/lib/supabase'
import { S } from '@/lib/strings'

export function Login() {
  const { session, signIn } = useAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to="/" replace />

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn(identifier, password)
    } catch (err) {
      setError(readableError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div
            className="mx-auto mb-4 h-12 w-12 rounded-full"
            style={{
              background:
                'conic-gradient(#0B5FFF 0turn 0.25turn, #F20D1B 0.25turn 0.5turn, #00A94F 0.5turn 0.75turn, #FFFF00 0.75turn 1turn)',
            }}
          />
          <h1 className="text-2xl font-bold">{S.loginTitle}</h1>
          <p className="mt-1 text-sm text-neutral-500">{S.loginSubtitle}</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"
        >
          <div>
            <label
              htmlFor="identifier"
              className="mb-1 block text-sm font-medium text-neutral-700"
            >
              {S.username}
            </label>
            {/* Deliberately type="text": captains type a username, not an
                address, and type="email" would reject it before submit. */}
            <input
              id="identifier"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-ink"
            />
            <p className="mt-1 text-xs text-neutral-400">{S.usernameHint}</p>
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-neutral-700"
            >
              {S.password}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 outline-none focus:border-ink"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={busy}>
            {busy ? S.signingIn : S.signIn}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-neutral-400">
          Accounts are created by the admin.
        </p>
      </div>
    </div>
  )
}
