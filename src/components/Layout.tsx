import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { S } from '@/lib/strings'

export function Layout({ children }: { children: ReactNode }) {
  const { profile, isAdmin, signOut } = useAuth()

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <span
              className="inline-block h-5 w-5 rounded-full"
              style={{
                background:
                  'conic-gradient(#0B5FFF 0turn 0.25turn, #F20D1B 0.25turn 0.5turn, #00A94F 0.5turn 0.75turn, #FFFF00 0.75turn 1turn)',
              }}
              aria-hidden
            />
            Team Picker
          </Link>

          <nav className="ml-auto flex items-center gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `rounded-lg px-3 py-1.5 text-sm transition ${
                  isActive
                    ? 'bg-neutral-100 font-medium text-ink'
                    : 'text-neutral-600 hover:text-ink'
                }`
              }
            >
              {S.dashboard}
            </NavLink>

            {isAdmin && (
              <NavLink
                to="/access"
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm transition ${
                    isActive
                      ? 'bg-neutral-100 font-medium text-ink'
                      : 'text-neutral-600 hover:text-ink'
                  }`
                }
              >
                {S.access}
              </NavLink>
            )}
          </nav>

          <div className="ml-2 hidden items-center gap-2 border-l border-neutral-200 pl-3 sm:flex">
            <span className="max-w-[10rem] truncate text-sm text-neutral-500">
              {profile?.full_name || profile?.email}
            </span>
            {isAdmin && (
              <span className="rounded-full bg-ink px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-white">
                Admin
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => void signOut()}
            className="ml-1 rounded-lg px-2.5 py-1.5 text-sm text-neutral-500 transition hover:bg-neutral-100 hover:text-ink"
          >
            {S.signOut}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 pb-24">{children}</main>
    </div>
  )
}
