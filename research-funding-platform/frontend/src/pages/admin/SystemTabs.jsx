import { useState } from 'react'
import { Activity, Clock, Database, Megaphone, Play, RefreshCw, Search, Server, Send, TriangleAlert } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  ErrorState,
  Field,
  Input,
  LoadingState,
  Pagination,
  StatCard,
  Table,
  Textarea,
  useToast,
} from '../../components/ui'
import { adminApi } from '../../api/admin'
import { getErrorMessage } from '../../api/client'
import { useApi, useDebounce } from '../../utils/hooks'
import { formatDateTime, formatDecimal, formatNumber, humanize, timeAgo } from '../../utils/format'
import { ROLE_LABELS, ROLES } from '../../utils/labels'

function formatUptime(seconds) {
  if (seconds === null || seconds === undefined) return '—'
  const s = Math.floor(Number(seconds))
  const days = Math.floor(s / 86400)
  const hours = Math.floor((s % 86400) / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  if (days) return `${days}d ${hours}h`
  if (hours) return `${hours}h ${minutes}m`
  return `${minutes}m ${s % 60}s`
}

export function AuditTab() {
  const [q, setQ] = useState('')
  const debouncedQ = useDebounce(q, 400)
  const [action, setAction] = useState('')
  const debouncedAction = useDebounce(action, 400)
  const [page, setPage] = useState(1)
  const { data, error, loading, reload } = useApi(
    () => adminApi.auditLogs({ q: debouncedQ, action: debouncedAction, page, page_size: 20 }),
    [debouncedQ, debouncedAction, page],
  )
  return (
    <div className="space-y-4">
      <Card padded>
        <div className="grid gap-3 md:grid-cols-[1fr_16rem_auto]">
          <Input
            icon={Search}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
            placeholder="Search user, entity or detail"
            aria-label="Search audit log"
          />
          <Input
            value={action}
            onChange={(e) => {
              setAction(e.target.value)
              setPage(1)
            }}
            placeholder="Action, e.g. auth.login"
            aria-label="Filter by action"
          />
          <Button variant="secondary" icon={RefreshCw} onClick={() => reload()} loading={loading && Boolean(data)}>
            Refresh
          </Button>
        </div>
      </Card>
      <Card>
        <div className="px-2 py-2">
          {error && !data ? (
            <ErrorState compact message={error} onRetry={reload} />
          ) : !data ? (
            <LoadingState compact />
          ) : (
            <div className={loading ? 'opacity-60' : ''}>
              <Table
                dense
                rows={data.items || []}
                empty="No audit events match."
                columns={[
                  { key: 'created_at', header: 'When', render: (row) => <span title={formatDateTime(row.created_at)}>{formatDateTime(row.created_at)}</span> },
                  { key: 'user_email', header: 'User', render: (row) => row.user_email || <span className="text-slate-400">system / anonymous</span> },
                  { key: 'action', header: 'Action', render: (row) => <span className="font-mono text-xs">{row.action}</span> },
                  { key: 'entity', header: 'Entity', render: (row) => (row.entity_type ? `${row.entity_type}${row.entity_id ? ` #${row.entity_id}` : ''}` : '—') },
                  { key: 'detail', header: 'Detail', className: 'max-w-md', render: (row) => (row.detail == null || row.detail === ''
                    ? <span className="text-slate-400">—</span>
                    : <span className="text-xs text-slate-600">{typeof row.detail === 'string' ? row.detail : JSON.stringify(row.detail)}</span>) },
                  { key: 'ip_address', header: 'IP', render: (row) => <span className="font-mono text-xs">{row.ip_address || '—'}</span> },
                ]}
              />
              <Pagination className="px-3 py-3" page={data.page || page} pages={data.pages} total={data.total} pageSize={data.page_size || 20} onChange={setPage} />
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

export function SystemTab() {
  const toast = useToast()
  const { data, error, loading, reload } = useApi(() => adminApi.system(), [])
  const [running, setRunning] = useState(null)

  const runJob = async (name) => {
    setRunning(name)
    try {
      const result = await adminApi.runJob(name)
      const ok = !result?.status || ['ok', 'success', 'completed'].includes(String(result.status).toLowerCase())
      ;(ok ? toast.success : toast.warning)(`${humanize(name)}: ${result?.detail || result?.status || 'done'}`)
      reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setRunning(null)
    }
  }

  if (error && !data) return <ErrorState message={error} onRetry={reload} />
  if (!data) return <LoadingState />
  const metrics = data.metrics || {}
  const config = data.config || {}

  return (
    <div className={loading ? 'space-y-6 opacity-70' : 'space-y-6'}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge color={data.database?.ok ? 'green' : 'rose'} icon={data.database?.ok ? Database : TriangleAlert}>
          Database ({data.database?.dialect || 'unknown'}): {data.database?.ok ? 'healthy' : 'unavailable'}
        </Badge>
        {data.version && <Badge color="slate">Version {data.version}</Badge>}
        {data.environment && <Badge color="slate">Environment: {data.environment}</Badge>}
        <Button size="sm" variant="ghost" icon={RefreshCw} onClick={() => reload()} className="ml-auto">
          Refresh
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Uptime" value={formatUptime(data.uptime_seconds)} icon={Clock} tone="indigo" />
        <StatCard label="Requests served" value={formatNumber(metrics.requests_total)} icon={Activity} tone="violet" />
        <StatCard label="Errors (5xx)" value={formatNumber(metrics.errors_total)} icon={TriangleAlert} tone="rose" />
        <StatCard label="Average latency" value={`${formatDecimal(metrics.avg_latency_ms, 1)} ms`} icon={Server} tone="sky" />
        <StatCard label="p95 latency" value={`${formatDecimal(metrics.p95_latency_ms, 1)} ms`} icon={Server} tone="amber" />
      </div>

      <Card>
        <CardHeader title="Background jobs" subtitle="Scheduled tasks run automatically; you can also trigger them manually." />
        <div className="px-2 py-2">
          <Table
            rows={data.jobs || []}
            rowKey="name"
            empty="No background jobs registered."
            columns={[
              { key: 'name', header: 'Job', render: (row) => <span className="font-medium text-slate-800">{humanize(row.name)}</span> },
              { key: 'enabled', header: 'Schedule', render: (row) => (row.enabled ? <Badge color="green">Every {row.interval_minutes} min</Badge> : <Badge color="slate">Manual only</Badge>) },
              { key: 'last_run_at', header: 'Last run', render: (row) => (row.last_run_at ? <span title={formatDateTime(row.last_run_at)}>{timeAgo(row.last_run_at)}</span> : 'Never') },
              {
                key: 'last_status',
                header: 'Last result',
                render: (row) =>
                  row.last_status ? (
                    <span className="text-xs">
                      <Badge color={['ok', 'success', 'completed'].includes(String(row.last_status).toLowerCase()) ? 'green' : 'amber'}>{row.last_status}</Badge>
                      {row.last_detail && <span className="ml-2 text-slate-500">{row.last_detail}</span>}
                    </span>
                  ) : (
                    '—'
                  ),
              },
              {
                key: 'run',
                header: <span className="sr-only">Run</span>,
                align: 'right',
                render: (row) => (
                  <Button size="xs" variant="secondary" icon={Play} onClick={() => runJob(row.name)} loading={running === row.name} disabled={Boolean(running)}>
                    Run now
                  </Button>
                ),
              },
            ]}
          />
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="API performance by route" />
          <div className="px-2 py-2">
            <Table
              dense
              className="max-h-96"
              rows={metrics.by_route || []}
              rowKey="route"
              empty="No requests recorded yet."
              columns={[
                { key: 'route', header: 'Route', render: (row) => <span className="font-mono text-xs">{row.route}</span> },
                { key: 'count', header: 'Calls', align: 'right', render: (row) => formatNumber(row.count) },
                { key: 'avg_ms', header: 'Avg ms', align: 'right', render: (row) => formatDecimal(row.avg_ms, 1) },
                { key: 'p95_ms', header: 'p95 ms', align: 'right', render: (row) => formatDecimal(row.p95_ms, 1) },
                { key: 'errors', header: 'Errors', align: 'right', render: (row) => formatNumber(row.errors ?? 0) },
              ]}
            />
          </div>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="External integrations" />
            <ul className="divide-y divide-slate-100">
              {(data.integrations || []).map((integration) => (
                <li key={integration.name} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{integration.name}</p>
                    {integration.detail && <p className="text-xs text-slate-500">{integration.detail}</p>}
                  </div>
                  <Badge color={integration.enabled ? 'green' : 'slate'}>{integration.enabled ? 'Enabled' : 'Not configured'}</Badge>
                </li>
              ))}
              {!(data.integrations || []).length && <li className="px-5 py-4 text-sm text-slate-500">No integrations reported.</li>}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Configuration (non-secret)" />
            <dl className="grid gap-x-6 gap-y-2 px-5 py-4 text-xs sm:grid-cols-2">
              {Object.entries(config).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-3 border-b border-slate-100 py-1">
                  <dt className="shrink-0 font-mono text-slate-500">{key}</dt>
                  <dd className="min-w-0 break-all text-right font-medium text-slate-800">{Array.isArray(value) ? value.join(', ') : typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  )
}

export function BroadcastTab() {
  const toast = useToast()
  const [form, setForm] = useState({ title: '', message: '' })
  const [roles, setRoles] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const send = async (event) => {
    event.preventDefault()
    if (form.title.trim().length < 3) return setError('Enter a title of at least 3 characters.')
    if (form.message.trim().length < 5) return setError('Enter a message of at least 5 characters.')
    setError(null)
    setBusy(true)
    try {
      const result = await adminApi.broadcast({ title: form.title.trim(), message: form.message.trim(), roles: roles.length ? roles : undefined })
      toast.success(`Notification sent to ${formatNumber(result?.created ?? 0)} user${result?.created === 1 ? '' : 's'}.`)
      setForm({ title: '', message: '' })
      setRoles([])
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader title="Broadcast a platform notification" subtitle="Appears in recipients' notification centre as a platform notification." icon={Megaphone} />
      <form onSubmit={send} className="space-y-4 px-5 py-4" noValidate>
        {error && <Alert variant="error">{error}</Alert>}
        <Field label="Title" required>
          {(id) => <Input id={id} value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} maxLength={200} />}
        </Field>
        <Field label="Message" required>
          {(id) => <Textarea id={id} rows={4} value={form.message} onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))} maxLength={2000} />}
        </Field>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-700">Recipients</legend>
          <p className="mb-2 text-xs text-slate-500">Leave all unchecked to notify every active user.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {ROLES.map((role) => (
              <Checkbox
                key={role}
                label={ROLE_LABELS[role]}
                checked={roles.includes(role)}
                onChange={() => setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]))}
              />
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end">
          <Button type="submit" icon={Send} loading={busy}>
            Send notification
          </Button>
        </div>
      </form>
    </Card>
  )
}
