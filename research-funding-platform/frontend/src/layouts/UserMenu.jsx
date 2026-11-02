import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, ChevronDown, LogOut, Settings, UserRound } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { RoleBadge } from '../components/domain/Badges'
import { initials } from '../utils/format'

export default function UserMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
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

  if (!user) return null
  const itemClass = 'flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 hover:bg-slate-100"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-semibold text-white">
          {initials(user.full_name, user.email)}
        </span>
        <span className="hidden max-w-[10rem] truncate text-sm font-medium text-slate-700 md:block">{user.full_name || user.email}</span>
        <ChevronDown className="hidden h-4 w-4 text-slate-400 md:block" aria-hidden="true" />
      </button>
      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 animate-fade-in overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="truncate text-sm font-semibold text-slate-900">{user.full_name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
            <div className="mt-2">
              <RoleBadge role={user.role} />
            </div>
          </div>
          <Link to="/app/profile" className={itemClass} onClick={() => setOpen(false)}>
            <UserRound className="h-4 w-4 text-slate-400" /> Research profile
          </Link>
          <Link to="/app/settings" className={itemClass} onClick={() => setOpen(false)}>
            <Settings className="h-4 w-4 text-slate-400" /> Settings
          </Link>
          <a href="/docs" target="_blank" rel="noreferrer" className={itemClass} onClick={() => setOpen(false)}>
            <BookOpen className="h-4 w-4 text-slate-400" /> API documentation
          </a>
          <button type="button" className={`${itemClass} border-t border-slate-100 text-rose-600`} onClick={logout}>
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
