import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/auth/AuthProvider'
import { Layout } from '@/components/Layout'
import { ToastProvider } from '@/components/Toast'
import { isSupabaseConfigured } from '@/lib/supabase'
import { Access } from '@/pages/Access'
import { Dashboard } from '@/pages/Dashboard'
import {
  FullPageLoader,
  NoAccess,
  NotFound,
  SetupNotice,
} from '@/pages/Fallbacks'
import { Login } from '@/pages/Login'
import { TeamView } from '@/pages/TeamView'
import { WaitingList } from '@/pages/WaitingList'

function RequireAuth({
  children,
  adminOnly = false,
}: {
  children: ReactNode
  adminOnly?: boolean
}) {
  const { session, loading, isAdmin } = useAuth()

  if (loading) return <FullPageLoader />
  if (!session) return <Navigate to="/login" replace />
  if (adminOnly && !isAdmin) {
    return (
      <Layout>
        <NoAccess />
      </Layout>
    )
  }
  return <Layout>{children}</Layout>
}

function Router() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      />
      <Route
        path="/team/:slug"
        element={
          <RequireAuth>
            <TeamView />
          </RequireAuth>
        }
      />
      <Route
        path="/waiting"
        element={
          <RequireAuth>
            <WaitingList />
          </RequireAuth>
        }
      />
      <Route
        path="/access"
        element={
          <RequireAuth adminOnly>
            <Access />
          </RequireAuth>
        }
      />
      <Route
        path="*"
        element={
          <RequireAuth>
            <NotFound />
          </RequireAuth>
        }
      />
    </Routes>
  )
}

export default function App() {
  if (!isSupabaseConfigured) return <SetupNotice />

  return (
    <AuthProvider>
      <ToastProvider>
        <Router />
      </ToastProvider>
    </AuthProvider>
  )
}
