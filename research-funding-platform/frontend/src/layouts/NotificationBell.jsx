import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { Bell, CheckCheck } from 'lucide-react'
import { notificationsApi } from '../api/notifications'
import { getErrorMessage } from '../api/client'
import { useUnreadCount } from './NotificationContext'
import { Spinner } from '../components/ui/Spinner'
import { timeAgo, truncate } from '../utils/format'
import { NOTIFICATION_TYPE_LABELS, labelFor } from '../utils/labels'

export default function NotificationBell() {
  const { unreadCount, refreshUnread } = useUnreadCount()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const ref = useRef(null)
  const navigate = useNavigate()

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await notificationsApi.list({ page: 1, page_size: 6 })
      setItems(result?.items || [])
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return undefined
    load()
    const onDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false)
    }
    const onKey = (event) => event.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const openItem = async (item) => {
    setOpen(false)
    if (!item.is_read) {
      try {
        await notificationsApi.markRead(item.id)
        refreshUnread()
      } catch {
        /* non-blocking */
      }
    }
    if (item.link && item.link.startsWith('/')) navigate(item.link)
    else navigate('/app/notifications')
  }

  const markAll = async () => {
    try {
      await notificationsApi.markAllRead()
      setItems((list) => list.map((item) => ({ ...item, is_read: true })))
      refreshUnread()
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] animate-fade-in overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Notifications</p>
            <button
              type="button"
              onClick={markAll}
              disabled={!unreadCount}
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:text-slate-300"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading && !items.length ? (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            ) : error ? (
              <p className="px-4 py-6 text-center text-sm text-rose-600">{error}</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">You're all caught up.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {items.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className={clsx('flex w-full gap-3 px-4 py-3 text-left hover:bg-slate-50', !item.is_read && 'bg-indigo-50/40')}
                    >
                      <span
                        className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', item.is_read ? 'bg-transparent' : 'bg-indigo-600')}
                        aria-label={item.is_read ? undefined : 'Unread'}
                      />
                      <span className="min-w-0">
                        <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-400">
                          {labelFor(NOTIFICATION_TYPE_LABELS, item.type)}
                        </span>
                        <span className="block text-sm font-medium text-slate-800">{item.title}</span>
                        {item.message && <span className="block text-xs text-slate-500">{truncate(item.message, 110)}</span>}
                        <span className="mt-0.5 block text-[11px] text-slate-400">{timeAgo(item.created_at)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Link
            to="/app/notifications"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-100 px-4 py-2.5 text-center text-sm font-medium text-indigo-600 hover:bg-slate-50"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  )
}
