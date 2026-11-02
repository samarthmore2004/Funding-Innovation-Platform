import { Link, Navigate, useLocation } from 'react-router-dom'
import { CloudOff, RefreshCw, ShieldAlert } from 'lucide-react'
import { useAuth } from './AuthContext'
import { FullPageLoader } from '../components/ui/Spinner'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import { ROLE_LABELS } from '../utils/labels'

/**
 * Renders children only for signed-in users; otherwise redirects to /login and remembers the
 * target. If a stored session could not be verified because the API is down, offers a retry
 * instead of discarding the session.
 */
export function ProtectedRoute({ children }) {
  const { user, loading, sessionError, restoreSession, logout } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageLoader label="Restoring your session…" />
  if (!user && sessionError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <EmptyState
          icon={CloudOff}
          title="We can't reach the platform right now"
          description={`${sessionError} Your session is kept — try again in a moment.`}
          action={
            <>
              <Button icon={RefreshCw} onClick={() => restoreSession()}>
                Try again
              </Button>
              <Button variant="secondary" onClick={logout}>
                Sign out
              </Button>
            </>
          }
        />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  return children
}

/** Restricts a route to the given roles and explains why access is denied. */
export function RoleRoute({ roles, children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (!roles.includes(user.role)) {
    return (
      <div className="py-16">
        <EmptyState
          icon={ShieldAlert}
          title="You don't have access to this page"
          description={`This area is available to: ${roles.map((role) => ROLE_LABELS[role] || role).join(', ')}. You are signed in as ${ROLE_LABELS[user.role] || user.role}.`}
          action={
            <Button as={Link} to="/app" variant="secondary">
              Back to dashboard
            </Button>
          }
        />
      </div>
    )
  }
  return children
}
