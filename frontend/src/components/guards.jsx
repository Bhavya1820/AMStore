import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function FullScreenLoader() {
  return (
    <div className="center-screen" role="status" aria-label="Loading">
      <div className="loader" />
    </div>
  )
}

// Signed-in only. Users still on a temporary password are funnelled to /change-password.
export function ProtectedRoute() {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullScreenLoader />
  if (status !== 'authed') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (user.mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }
  return <Outlet />
}

// Login / register: bounce signed-in users to the app
export function GuestRoute() {
  const { status, user } = useAuth()
  if (status === 'loading') return <FullScreenLoader />
  if (status === 'authed') return <Navigate to={user.mustChangePassword ? '/change-password' : '/dashboard'} replace />
  return <Outlet />
}

export function RequirePermission({ permission, children }) {
  const { has } = useAuth()
  return has(permission) ? children : <Navigate to="/dashboard" replace />
}
