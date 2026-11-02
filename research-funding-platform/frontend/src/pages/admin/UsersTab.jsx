import { useState } from 'react'
import { Search, UserCheck, UserX } from 'lucide-react'
import { Badge, Button, Card, ConfirmDialog, ErrorState, Input, LoadingState, Pagination, Select, Table, useToast } from '../../components/ui'
import { adminApi } from '../../api/admin'
import { getErrorMessage } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { useApi, useDebounce } from '../../utils/hooks'
import { formatDateTime, formatNumber, timeAgo } from '../../utils/format'
import { ROLE_LABELS, optionsFrom } from '../../utils/labels'

export default function UsersTab() {
  const toast = useToast()
  const { user: me } = useAuth()
  const [q, setQ] = useState('')
  const debouncedQ = useDebounce(q, 400)
  const [role, setRole] = useState('')
  const [active, setActive] = useState('')
  const [page, setPage] = useState(1)
  const [pendingStatus, setPendingStatus] = useState(null)
  const { data, error, loading, reload } = useApi(
    () => adminApi.users({ q: debouncedQ, role, is_active: active, page, page_size: 15 }),
    [debouncedQ, role, active, page],
  )

  const changeRole = async (user, nextRole) => {
    try {
      await adminApi.updateUser(user.id, { role: nextRole })
      toast.success(`${user.full_name || user.email} is now ${ROLE_LABELS[nextRole]}.`)
      reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
      reload()
    }
  }

  const changeStatus = async () => {
    const target = pendingStatus
    try {
      await adminApi.updateUser(target.id, { is_active: !target.is_active })
      toast.success(`${target.full_name || target.email} ${target.is_active ? 'deactivated' : 'reactivated'}.`)
      setPendingStatus(null)
      reload()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <div className="space-y-4">
      <Card padded>
        <div className="grid gap-3 md:grid-cols-[1fr_14rem_12rem]">
          <Input
            icon={Search}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(1)
            }}
            placeholder="Search by name, email or organization"
            aria-label="Search users"
          />
          <Select
            aria-label="Filter by role"
            value={role}
            onChange={(e) => {
              setRole(e.target.value)
              setPage(1)
            }}
            options={optionsFrom(ROLE_LABELS)}
            placeholder="All roles"
          />
          <Select
            aria-label="Filter by status"
            value={active}
            onChange={(e) => {
              setActive(e.target.value)
              setPage(1)
            }}
            options={[
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Deactivated' },
            ]}
            placeholder="Any status"
          />
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
                rows={data.items || []}
                empty="No users match these filters."
                columns={[
                  {
                    key: 'name',
                    header: 'User',
                    className: 'min-w-[14rem]',
                    render: (row) => (
                      <div>
                        <p className="font-medium text-slate-800">
                          {row.full_name}
                          {row.id === me?.id && <span className="ml-1 text-xs text-slate-400">(you)</span>}
                        </p>
                        <p className="text-xs text-slate-500">{row.email}</p>
                        {row.organization && <p className="text-xs text-slate-400">{row.organization}</p>}
                      </div>
                    ),
                  },
                  {
                    key: 'role',
                    header: 'Role',
                    render: (row) => (
                      <Select
                        aria-label={`Role for ${row.email}`}
                        value={row.role}
                        disabled={row.id === me?.id}
                        onChange={(e) => changeRole(row, e.target.value)}
                        options={optionsFrom(ROLE_LABELS)}
                        className="h-8 w-44 text-xs"
                      />
                    ),
                  },
                  {
                    key: 'is_active',
                    header: 'Status',
                    render: (row) => (row.is_active ? <Badge color="green">Active</Badge> : <Badge color="rose">Deactivated</Badge>),
                  },
                  { key: 'projects_count', header: 'Projects', align: 'right', render: (row) => formatNumber(row.projects_count ?? 0) },
                  {
                    key: 'last_login_at',
                    header: 'Last sign-in',
                    render: (row) => <span title={formatDateTime(row.last_login_at)}>{row.last_login_at ? timeAgo(row.last_login_at) : 'Never'}</span>,
                  },
                  { key: 'created_at', header: 'Joined', render: (row) => formatDateTime(row.created_at) },
                  {
                    key: 'actions',
                    header: <span className="sr-only">Actions</span>,
                    align: 'right',
                    render: (row) =>
                      row.id === me?.id ? null : (
                        <Button
                          size="xs"
                          variant={row.is_active ? 'danger-ghost' : 'subtle'}
                          icon={row.is_active ? UserX : UserCheck}
                          onClick={() => setPendingStatus(row)}
                        >
                          {row.is_active ? 'Deactivate' : 'Reactivate'}
                        </Button>
                      ),
                  },
                ]}
              />
              <Pagination className="px-3 py-3" page={data.page || page} pages={data.pages} total={data.total} pageSize={data.page_size || 15} onChange={setPage} />
            </div>
          )}
        </div>
      </Card>
      <ConfirmDialog
        open={Boolean(pendingStatus)}
        danger={pendingStatus?.is_active}
        title={pendingStatus?.is_active ? 'Deactivate user?' : 'Reactivate user?'}
        message={
          pendingStatus?.is_active
            ? `${pendingStatus?.email} will no longer be able to sign in.`
            : `${pendingStatus?.email} will be able to sign in again.`
        }
        confirmLabel={pendingStatus?.is_active ? 'Deactivate' : 'Reactivate'}
        onConfirm={changeStatus}
        onCancel={() => setPendingStatus(null)}
      />
    </div>
  )
}
