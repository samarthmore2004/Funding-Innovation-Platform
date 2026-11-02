import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Briefcase, CircleCheck, GraduationCap, Rocket, UserPlus } from 'lucide-react'
import AuthShell from './AuthShell'
import OAuthButtons from '../components/domain/OAuthButtons'
import { passwordProblems } from '../utils/validation'
import { Alert, Button, Field, Input } from '../components/ui'
import { useAuth } from '../auth/AuthContext'
import { getErrorMessage } from '../api/client'
import { useDocumentTitle } from '../utils/hooks'

const ROLE_CHOICES = [
  { value: 'researcher', label: 'Researcher', icon: GraduationCap, text: 'Find grants, track research trends and score your work.' },
  { value: 'startup_founder', label: 'Startup founder', icon: Rocket, text: 'Find accelerators and funds, watch competitors, plan go-to-market.' },
  { value: 'innovation_manager', label: 'Innovation manager', icon: Briefcase, text: 'Track a portfolio, pipeline and technology trends.' },
]

export default function RegisterPage() {
  useDocumentTitle('Create account')
  const { user, register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ full_name: '', email: '', organization: '', role: 'researcher', password: '', confirm: '' })
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [touched, setTouched] = useState(false)

  if (user) return <Navigate to="/app" replace />

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))
  const problems = passwordProblems(form.password)

  const submit = async (event) => {
    event.preventDefault()
    setTouched(true)
    if (form.full_name.trim().length < 2) return setError('Enter your full name.')
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError('Enter a valid email address.')
    if (problems.length) return setError(`Password needs ${problems.join(', ')}.`)
    if (form.password !== form.confirm) return setError('Passwords do not match.')
    setSubmitting(true)
    setError(null)
    try {
      await register({
        full_name: form.full_name.trim(),
        email: form.email.trim(),
        organization: form.organization.trim() || null,
        role: form.role,
        password: form.password,
      })
      navigate('/app/profile?welcome=1', { replace: true })
    } catch (err) {
      setError(getErrorMessage(err, 'Registration failed.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Choose the workspace that fits your role. You can complete your research profile next."
      footer={
        <>
          Already registered?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-800">
            Sign in
          </Link>
        </>
      }
    >
      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">I am a…</legend>
          <div className="grid gap-2">
            {ROLE_CHOICES.map((choice) => {
              const selected = form.role === choice.value
              return (
                <label
                  key={choice.value}
                  className={clsx(
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition',
                    selected ? 'border-indigo-500 bg-indigo-50/60 ring-1 ring-indigo-500' : 'border-slate-200 hover:border-slate-300',
                  )}
                >
                  <input
                    type="radio"
                    name="role"
                    value={choice.value}
                    checked={selected}
                    onChange={set('role')}
                    className="sr-only"
                  />
                  <choice.icon className={clsx('mt-0.5 h-5 w-5 shrink-0', selected ? 'text-indigo-600' : 'text-slate-400')} />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">{choice.label}</span>
                    <span className="block text-xs text-slate-500">{choice.text}</span>
                  </span>
                  {selected && <CircleCheck className="ml-auto h-5 w-5 shrink-0 text-indigo-600" />}
                </label>
              )
            })}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            {(id) => <Input id={id} autoComplete="name" value={form.full_name} onChange={set('full_name')} />}
          </Field>
          <Field label="Organization">
            {(id) => <Input id={id} autoComplete="organization" value={form.organization} onChange={set('organization')} placeholder="Optional" />}
          </Field>
        </div>
        <Field label="Email address" required>
          {(id) => <Input id={id} type="email" autoComplete="email" value={form.email} onChange={set('email')} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Password"
            required
            hint="8–72 characters with at least one letter and one digit."
            error={touched && problems.length ? `Needs ${problems.join(', ')}` : null}
          >
            {(id) => <Input id={id} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />}
          </Field>
          <Field label="Confirm password" required error={touched && form.confirm && form.confirm !== form.password ? 'Passwords do not match' : null}>
            {(id) => <Input id={id} type="password" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} />}
          </Field>
        </div>
        <Button type="submit" className="w-full" size="lg" loading={submitting} icon={UserPlus}>
          Create account
        </Button>
        <p className="text-center text-xs text-slate-500">
          Administrator accounts cannot be self-registered; an existing administrator assigns that role.
        </p>
      </form>
      <OAuthButtons />
    </AuthShell>
  )
}
