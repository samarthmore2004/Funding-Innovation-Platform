import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, LogIn, Mail } from 'lucide-react'
import AuthShell from './AuthShell'
import { Alert, Button, Field, Input } from '../components/ui'
import { useAuth } from '../auth/AuthContext'
import OAuthButtons from '../components/domain/OAuthButtons'
import { getErrorMessage } from '../api/client'
import { useDocumentTitle } from '../utils/hooks'

export default function LoginPage() {
  useDocumentTitle('Sign in')
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const from = location.state?.from && location.state.from.startsWith('/app') ? location.state.from : '/app'

  if (user) return <Navigate to={from} replace />

  const submit = async (event) => {
    event.preventDefault()
    if (!email.trim() || !password) {
      setError('Enter your email and password.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await login(email.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, 'Sign-in failed.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your innovation intelligence workspace."
      footer={
        <>
          New to the platform?{' '}
          <Link to="/register" className="font-medium text-indigo-600 hover:text-indigo-800">
            Create an account
          </Link>
        </>
      }
    >
      {location.state?.expired && !error && (
        <Alert variant="warning" className="mb-4">
          Your session has expired. Please sign in again.
        </Alert>
      )}
      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email address" required>
          {(id) => (
            <Input
              id={id}
              type="email"
              icon={Mail}
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@organization.org"
            />
          )}
        </Field>
        <Field label="Password" required>
          {(id) => (
            <div className="relative">
              <Input
                id={id}
                type={show ? 'text' : 'password'}
                icon={Lock}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          )}
        </Field>
        <Button type="submit" className="w-full" size="lg" loading={submitting} icon={LogIn}>
          Sign in
        </Button>
      </form>
      <OAuthButtons />
    </AuthShell>
  )
}
