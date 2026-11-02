import { useState } from 'react'
import { Link } from 'react-router-dom'
import clsx from 'clsx'
import {
  Bell,
  BellRing,
  CalendarClock,
  CheckCheck,
  Cpu,
  FileText,
  Megaphone,
  RefreshCw,
  Rocket,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react'
import { Badge, Button, Card, EmptyState, ErrorState, LoadingState, PageHeader, Pagination, Select, Toggle, useToast } from '../components/ui'
import { notificationsApi } from '../api/notifications'
import { getErrorMessage } from '../api/client'
import { useApi } from '../utils/hooks'
import { useUnreadCount } from '../layouts/NotificationContext'
import { formatDateTime, timeAgo } from '../utils/format'
import { NOTIFICATION_TYPE_LABELS, labelFor, optionsFrom } from '../utils/labels'

const TYPE_ICONS = {
  funding_match: Sparkles,
  funding_deadline: CalendarClock,
  patent_alert: FileText,
  tech_alert: Cpu,
  trend_update: TrendingUp,
  commercialization: Rocket,
  system: Megaphone,
}
const PRIORITY_COLORS = { high: 'rose', normal: 'slate', low: 'slate' }

export default function NotificationsPage() {
  const toast = useToast()
  const { refreshUnread } = useUnreadCount()
  const [type, setType] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(1)
  const [refreshing, setRefreshing] = useState(false)
  const { data, error, loading, reload } = useApi(
    () => notificationsApi.list({ type, unread_only: unreadOnly || undefined, page, page_size: 15 }),
    [type, unreadOnly, page],
  )
  const items = data?.items || []

  const after = async () => {
    await reload()
    refreshUnread()
  }

  const markRead = async (item) => {
    try {
      await notificationsApi.markRead(item.id)
      after()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const markAll = async () => {
    try {
      const result = await notificationsApi.markAllRead()
      toast.success(`${result?.updated ?? 'All'} notification${result?.updated === 1 ? '' : 's'} marked as read.`)
      after()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const remove = async (item) => {
    try {
      await notificationsApi.remove(item.id)
      after()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    try {
      const result = await notificationsApi.refresh()
      const created = result?.created ?? 0
      toast.success(created ? `${created} new alert${created === 1 ? '' : 's'} generated.` : 'No new alerts — you are up to date.')
      setPage(1)
      after()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div>
      <PageHeader
        icon={Bell}
        title="Notifications & alerts"
        description="New funding matches, deadline reminders, patent monitoring, emerging technology, research trend and commercialization alerts."
        actions={
          <>
            <Button variant="secondary" icon={CheckCheck} onClick={markAll} disabled={!data?.unread_count}>
              Mark all read
            </Button>
            <Button icon={RefreshCw} onClick={refresh} loading={refreshing}>
              Check for new alerts
            </Button>
          </>
        }
      />
      <Card padded className="mb-5">
        <div className="flex flex-wrap items-center gap-4">
          <Select
            aria-label="Filter by type"
            value={type}
            onChange={(e) => {
              setType(e.target.value)
              setPage(1)
            }}
            options={optionsFrom(NOTIFICATION_TYPE_LABELS)}
            placeholder="All alert types"
            className="w-64"
          />
          <Toggle
            checked={unreadOnly}
            onChange={(value) => {
              setUnreadOnly(value)
              setPage(1)
            }}
            label="Unread only"
          />
          {data && <span className="ml-auto text-sm text-slate-500">{data.unread_count ?? 0} unread</span>}
        </div>
      </Card>

      {error && !data ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !data ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState
          icon={BellRing}
          title={unreadOnly || type ? 'No notifications match these filters' : 'No notifications yet'}
          description="Alerts are generated from your profile, tracked opportunities and technology areas. Use “Check for new alerts” to run the alert engine now."
        />
      ) : (
        <Card className={loading ? 'opacity-60' : ''}>
          <ul className="divide-y divide-slate-100">
            {items.map((item) => {
              const Icon = TYPE_ICONS[item.type] || Bell
              return (
                <li key={item.id} className={clsx('flex gap-4 px-5 py-4', !item.is_read && 'bg-indigo-50/40')}>
                  <span
                    className={clsx(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                      item.is_read ? 'bg-slate-100 text-slate-500' : 'bg-indigo-100 text-indigo-600',
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{labelFor(NOTIFICATION_TYPE_LABELS, item.type)}</span>
                      {item.priority === 'high' && <Badge color={PRIORITY_COLORS.high}>High priority</Badge>}
                      {!item.is_read && <span className="h-2 w-2 rounded-full bg-indigo-600" aria-label="Unread" />}
                    </div>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900">{item.title}</p>
                    {item.message && <p className="mt-0.5 text-sm text-slate-600">{item.message}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                      <span className="text-slate-400" title={formatDateTime(item.created_at)}>
                        {timeAgo(item.created_at)}
                      </span>
                      {item.link && item.link.startsWith('/') && (
                        <Link to={item.link} onClick={() => !item.is_read && markRead(item)} className="font-medium text-indigo-600 hover:text-indigo-800">
                          Open
                        </Link>
                      )}
                      {!item.is_read && (
                        <button type="button" onClick={() => markRead(item)} className="font-medium text-slate-500 hover:text-slate-800">
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                  <Button size="icon-sm" variant="ghost" onClick={() => remove(item)} aria-label="Delete notification">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              )
            })}
          </ul>
          <Pagination className="border-t border-slate-100 px-5 py-3" page={data.page || page} pages={data.pages} total={data.total} pageSize={data.page_size || 15} onChange={setPage} />
        </Card>
      )}
    </div>
  )
}
