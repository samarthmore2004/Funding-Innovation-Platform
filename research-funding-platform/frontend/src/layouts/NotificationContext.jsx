import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { notificationsApi } from '../api/notifications'

const NotificationContext = createContext({ unreadCount: 0, refreshUnread: () => {} })
const POLL_MS = 60000

/** Shares the unread-notification count between the bell, the sidebar and the notifications page. */
export function NotificationCountProvider({ children }) {
  const [unreadCount, setUnreadCount] = useState(0)
  const location = useLocation()

  const refreshUnread = useCallback(async () => {
    try {
      const result = await notificationsApi.unreadCount()
      setUnreadCount(Number(result?.unread_count) || 0)
    } catch {
      /* the bell simply keeps its last value when the API is unreachable */
    }
  }, [])

  // The initial fetch happens in the navigation effect below.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== 'hidden') refreshUnread()
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [refreshUnread])

  // Cheap re-sync on navigation so counts stay fresh after actions on other pages.
  useEffect(() => {
    refreshUnread()
  }, [location.pathname, refreshUnread])

  const value = useMemo(() => ({ unreadCount, setUnreadCount, refreshUnread }), [unreadCount, refreshUnread])
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUnreadCount() {
  return useContext(NotificationContext)
}
