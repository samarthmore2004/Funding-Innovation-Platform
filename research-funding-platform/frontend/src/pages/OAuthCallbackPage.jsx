import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { Button, EmptyState, FullPageLoader } from '../components/ui'
import { getErrorMessage } from '../api/client'
import { useDocumentTitle } from '../utils/hooks'

/** Receives `#access_token=...` (or `#error=...`) from the backend's OAuth2 callback redirect. */
export default function OAuthCallbackPage() {
  useDocumentTitle('Signing in')
  const { loginWithToken } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState(null)
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const token = params.get('access_token')
    const failure = params.get('error') || params.get('error_description')
    // Remove the token from the address bar/history immediately.
    window.history.replaceState(null, '', window.location.pathname)
    if (failure) {
      setError(failure)
      return
    }
    if (!token) {
      setError('No access token was returned by the sign-in provider.')
      return
    }
    loginWithToken(token)
      .then(() => navigate('/app', { replace: true }))
      .catch((err) => setError(getErrorMessage(err, 'Could not complete sign-in.')))
  }, [loginWithToken, navigate])

  if (!error) return <FullPageLoader label="Completing sign-in…" />
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <EmptyState
        icon={ShieldAlert}
        title="Sign-in could not be completed"
        description={error}
        action={
          <Button as={Link} to="/login">
            Back to sign in
          </Button>
        }
      />
    </div>
  )
}
