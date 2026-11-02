import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import clsx from 'clsx'
import { Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { NotificationCountProvider, useUnreadCount } from './NotificationContext'
import NotificationBell from './NotificationBell'
import UserMenu from './UserMenu'
import { titleForPath, visibleSections } from './navigation'
import { LoadingState } from '../components/ui/Spinner'
import { RoleBadge } from '../components/domain/Badges'
import { BrandMark } from './BrandMark'

const COLLAPSE_KEY = 'rfip_sidebar_collapsed'

function readCollapsed() {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}

function SidebarNav({ collapsed, onNavigate }) {
  const { user } = useAuth()
  const { unreadCount } = useUnreadCount()
  const sections = visibleSections(user?.role)
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4 scrollbar-thin" aria-label="Main navigation">
      {sections.map((section) => (
        <div key={section.title}>
          {!collapsed && (
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{section.title}</p>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = item.icon
              const badge = item.badgeKey === 'unread' && unreadCount > 0 ? unreadCount : null
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      clsx(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                        collapsed && 'justify-center px-0',
                        isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                      )
                    }
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                    {badge !== null && (
                      <span
                        className={clsx(
                          'rounded-full bg-rose-600 px-1.5 text-[10px] font-semibold text-white',
                          collapsed ? 'absolute right-1 top-1' : 'ml-auto',
                        )}
                      >
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </NavLink>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function Shell() {
  const { user } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  useEffect(() => {
    setMobileOpen(false)
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  useEffect(() => {
    if (!mobileOpen) return undefined
    const onKey = (event) => event.key === 'Escape' && setMobileOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  const title = titleForPath(location.pathname)

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-slate-200 bg-white transition-[width] duration-200 lg:flex',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        <div className={clsx('flex h-16 items-center border-b border-slate-100', collapsed ? 'justify-center' : 'px-5')}>
          <Link to="/app" className="flex items-center gap-2.5" aria-label="Dashboard">
            <BrandMark />
            {!collapsed && (
              <span className="text-sm font-semibold leading-tight text-slate-900">
                Funding &amp; Innovation
                <span className="block text-[11px] font-medium text-slate-500">Intelligence Platform</span>
              </span>
            )}
          </Link>
        </div>
        <SidebarNav collapsed={collapsed} />
        <div className="border-t border-slate-100 p-3">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className={clsx(
              'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700',
              collapsed && 'justify-center px-0',
            )}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && 'Collapse sidebar'}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <aside className="relative flex h-full w-72 max-w-[85vw] animate-slide-in flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4">
              <Link to="/app" className="flex items-center gap-2.5">
                <BrandMark />
                <span className="text-sm font-semibold text-slate-900">Funding &amp; Innovation</span>
              </Link>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarNav collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className={clsx('flex min-h-screen flex-col transition-[padding] duration-200', collapsed ? 'lg:pl-[72px]' : 'lg:pl-64')}>
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{title}</p>
          <div className="hidden sm:block">
            <RoleBadge role={user?.role} />
          </div>
          <NotificationBell />
          <UserMenu />
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <Suspense fallback={<LoadingState label="Loading page…" />}>
            <Outlet />
          </Suspense>
        </main>
        <footer className="border-t border-slate-200 bg-white px-6 py-3 text-center text-[11px] text-slate-400">
          Scores and recommendations are decision-support heuristics. Records marked “Illustrative sample” are synthetic demo
          data.
        </footer>
      </div>
    </div>
  )
}

export default function AppLayout() {
  return (
    <NotificationCountProvider>
      <Shell />
    </NotificationCountProvider>
  )
}
