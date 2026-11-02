import { useState } from 'react'
import { Bell, Download, KeyRound, Settings, ShieldCheck, Trash2, UserRound } from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  Field,
  Input,
  PageHeader,
  Toggle,
  useToast,
} from '../components/ui'
import { RoleBadge } from '../components/domain/Badges'
import { useAuth } from '../auth/AuthContext'
import { usersApi } from '../api/users'
import { authApi } from '../api/auth'
import { getErrorMessage } from '../api/client'
import { formatDateTime, humanize } from '../utils/format'
import { NOTIFICATION_TYPE_LABELS, NOTIFICATION_TYPES } from '../utils/labels'
import { passwordProblems } from '../utils/validation'

function AccountCard() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ full_name: user?.full_name || '', organization: user?.organization || '' })
  const [saving, setSaving] = useState(false)
  const save = async (event) => {
    event.preventDefault()
    if (form.full_name.trim().length < 2) {
      toast.error('Enter your full name.')
      return
    }
    setSaving(true)
    try {
      const updated = await usersApi.updateMe({ full_name: form.full_name.trim(), organization: form.organization.trim() || null })
      setUser(updated)
      toast.success('Account details saved.')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Card>
      <CardHeader title="Account" subtitle="Your name and organization as shown across the platform." icon={UserRound} />
      <form onSubmit={save} className="space-y-4 px-5 py-4">
        <dl className="grid gap-3 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">Email</dt>
            <dd className="font-medium text-slate-800">{user?.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Role</dt>
            <dd>
              <RoleBadge role={user?.role} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Sign-in method</dt>
            <dd className="text-slate-800">{humanize(user?.auth_provider || 'local')}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Member since</dt>
            <dd className="text-slate-800">{formatDateTime(user?.created_at)}</dd>
          </div>
        </dl>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" required>
            {(id) => <Input id={id} value={form.full_name} onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))} />}
          </Field>
          <Field label="Organization">
            {(id) => <Input id={id} value={form.organization} onChange={(e) => setForm((p) => ({ ...p, organization: e.target.value }))} />}
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            Save account
          </Button>
        </div>
      </form>
    </Card>
  )
}

function NotificationPreferencesCard() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const initial = user?.notification_preferences || {}
  const [prefs, setPrefs] = useState({
    in_app: initial.in_app ?? true,
    deadline_reminder_days: initial.deadline_reminder_days ?? 14,
    alert_types: initial.alert_types ?? NOTIFICATION_TYPES,
  })
  const [saving, setSaving] = useState(false)
  const toggleType = (type) =>
    setPrefs((prev) => ({
      ...prev,
      alert_types: prev.alert_types.includes(type) ? prev.alert_types.filter((t) => t !== type) : [...prev.alert_types, type],
    }))
  const save = async () => {
    const days = parseInt(prefs.deadline_reminder_days, 10)
    if (Number.isNaN(days) || days < 1 || days > 90) {
      toast.error('Deadline reminder must be between 1 and 90 days.')
      return
    }
    setSaving(true)
    try {
      const updated = await usersApi.updateMe({ notification_preferences: { ...prefs, deadline_reminder_days: days } })
      setUser(updated)
      toast.success('Notification preferences saved.')
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Card>
      <CardHeader title="Notification preferences" subtitle="Choose which alerts the alert engine generates for you." icon={Bell} />
      <div className="space-y-5 px-5 py-4">
        <Toggle
          checked={prefs.in_app}
          onChange={(value) => setPrefs((p) => ({ ...p, in_app: value }))}
          label="In-app notifications"
          description="Show alerts in the notification centre and bell."
        />
        <Field label="Deadline reminder window (days)" hint="Remind me about tracked opportunities closing within this many days." className="max-w-xs">
          {(id) => (
            <Input id={id} type="number" min={1} max={90} value={prefs.deadline_reminder_days} onChange={(e) => setPrefs((p) => ({ ...p, deadline_reminder_days: e.target.value }))} />
          )}
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Alert types</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {NOTIFICATION_TYPES.map((type) => (
              <Checkbox key={type} label={NOTIFICATION_TYPE_LABELS[type]} checked={prefs.alert_types.includes(type)} onChange={() => toggleType(type)} disabled={!prefs.in_app} />
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end">
          <Button onClick={save} loading={saving}>
            Save preferences
          </Button>
        </div>
      </div>
    </Card>
  )
}

function PasswordCard() {
  const { user } = useAuth()
  const toast = useToast()
  const [form, setForm] = useState({ current: '', next: '', confirm: '' })
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)
  const submit = async (event) => {
    event.preventDefault()
    const problems = passwordProblems(form.next)
    if (!form.current) return setError('Enter your current password.')
    if (problems.length) return setError(`New password needs ${problems.join(', ')}.`)
    if (form.next !== form.confirm) return setError('New passwords do not match.')
    setError(null)
    setSaving(true)
    try {
      await authApi.changePassword({ current_password: form.current, new_password: form.next })
      setForm({ current: '', next: '', confirm: '' })
      toast.success('Password changed.')
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Card>
      <CardHeader title="Change password" subtitle="Passwords are stored as salted bcrypt hashes." icon={KeyRound} />
      <form onSubmit={submit} className="space-y-4 px-5 py-4" noValidate>
        {user?.auth_provider && user.auth_provider !== 'local' && (
          <Alert variant="info">You signed in with {humanize(user.auth_provider)}. A local password may not be set for this account.</Alert>
        )}
        {error && <Alert variant="error">{error}</Alert>}
        <Field label="Current password">
          {(id) => <Input id={id} type="password" autoComplete="current-password" value={form.current} onChange={(e) => setForm((p) => ({ ...p, current: e.target.value }))} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password" hint="8–72 characters, a letter and a digit.">
            {(id) => <Input id={id} type="password" autoComplete="new-password" value={form.next} onChange={(e) => setForm((p) => ({ ...p, next: e.target.value }))} />}
          </Field>
          <Field label="Confirm new password">
            {(id) => <Input id={id} type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm((p) => ({ ...p, confirm: e.target.value }))} />}
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={saving}>
            Update password
          </Button>
        </div>
      </form>
    </Card>
  )
}

function PrivacyCard() {
  const { logout } = useAuth()
  const toast = useToast()
  const [exporting, setExporting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)

  const exportData = async () => {
    setExporting(true)
    try {
      const filename = await usersApi.exportMe()
      toast.success(`Downloaded ${filename}`)
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  const deleteAccount = async () => {
    if (!password) {
      setError('Enter your password to confirm.')
      return
    }
    try {
      await usersApi.deleteMe(password)
      toast.success('Your account has been deleted.')
      logout()
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <Card>
      <CardHeader title="Privacy & data" subtitle="Export or delete your personal data." icon={ShieldCheck} />
      <div className="space-y-4 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-4">
          <div>
            <p className="text-sm font-medium text-slate-900">Export my data</p>
            <p className="text-xs text-slate-500">Download your account, profile, publications, patents, projects, saved opportunities and notifications as JSON.</p>
          </div>
          <Button variant="secondary" icon={Download} onClick={exportData} loading={exporting}>
            Export JSON
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50/40 p-4">
          <div>
            <p className="text-sm font-medium text-rose-800">Delete my account</p>
            <p className="text-xs text-rose-700">Your account is deactivated and personal details are anonymised. This cannot be undone.</p>
          </div>
          <Button
            variant="danger"
            icon={Trash2}
            onClick={() => {
              setPassword('')
              setError(null)
              setConfirming(true)
            }}
          >
            Delete account
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        danger
        title="Delete your account?"
        confirmLabel="Delete my account"
        onConfirm={deleteAccount}
        onCancel={() => setConfirming(false)}
        message="Enter your password to confirm. You will be signed out immediately."
      >
        {error && <Alert variant="error">{error}</Alert>}
        <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Password" placeholder="Password" />
      </ConfirmDialog>
    </Card>
  )
}

export default function SettingsPage() {
  return (
    <div>
      <PageHeader icon={Settings} title="Settings" description="Manage your account, notification preferences, password and personal data." />
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <AccountCard />
          <PasswordCard />
        </div>
        <div className="space-y-6">
          <NotificationPreferencesCard />
          <PrivacyCard />
        </div>
      </div>
    </div>
  )
}
