import { Link } from 'react-router-dom'
import { S } from '@/lib/strings'

export function NotFound() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-10 text-center">
      <p className="text-lg font-medium">{S.notFound}</p>
      <Link to="/" className="btn-ghost mt-5">
        {S.back}
      </Link>
    </div>
  )
}

export function NoAccess() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-10 text-center">
      <p className="text-lg font-medium">{S.noAccess}</p>
      <Link to="/" className="btn-ghost mt-5">
        {S.back}
      </Link>
    </div>
  )
}

export function SetupNotice() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-4">
      <div className="max-w-md rounded-2xl border border-amber-300 bg-amber-50 p-6">
        <h1 className="text-lg font-semibold text-amber-900">
          Supabase is not configured
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-amber-800">
          Copy <code className="rounded bg-amber-100 px-1">.env.example</code> to{' '}
          <code className="rounded bg-amber-100 px-1">.env</code> and fill in{' '}
          <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_ANON_KEY</code>{' '}
          from your project's API settings, then restart the dev server.
        </p>
        <p className="mt-3 text-sm text-amber-800">
          The README walks through creating the project, running the migration and
          seed, and adding the seven accounts.
        </p>
      </div>
    </div>
  )
}

export function FullPageLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="flex items-center gap-3 text-sm text-neutral-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-ink" />
        {S.loading}
      </div>
    </div>
  )
}
