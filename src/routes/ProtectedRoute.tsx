import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function ProtectedRoute() {
  const { loading, session } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-app-bg">
        <div className="text-sm text-slate-500">Loading LedgeEaze…</div>
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />

  return <Outlet />
}

export function PublicOnlyRoute() {
  const { loading, session } = useAuth()

  if (loading) return null
  if (session) return <Navigate to="/" replace />

  return <Outlet />
}
