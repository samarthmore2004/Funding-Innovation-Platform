import { useState } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { Menu, X } from 'lucide-react'
import Button from '../components/ui/Button'
import { useAuth } from '../auth/AuthContext'
import { BrandMark } from './BrandMark'

const LINKS = [
  { href: '#modules', label: 'Modules' },
  { href: '#roles', label: 'Who it’s for' },
  { href: '#how', label: 'How it works' },
  { href: '#transparency', label: 'Data & transparency' },
]

export default function PublicLayout() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <BrandMark />
            <span className="text-sm font-semibold leading-tight text-slate-900">
              Research Funding &amp; Innovation
              <span className="block text-[11px] font-medium text-slate-500">Intelligence Platform</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-6 md:flex" aria-label="Landing page sections">
            {LINKS.map((link) => (
              <a key={link.href} href={link.href} className="text-sm font-medium text-slate-600 hover:text-slate-900">
                {link.label}
              </a>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <Button as={Link} to="/app">
                Open dashboard
              </Button>
            ) : (
              <>
                <Button as={Link} to="/login" variant="ghost">
                  Sign in
                </Button>
                <Button as={Link} to="/register">
                  Get started
                </Button>
              </>
            )}
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
        {open && (
          <div className="border-t border-slate-100 bg-white px-4 py-3 md:hidden">
            <nav className="flex flex-col gap-1" aria-label="Landing page sections">
              {LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  {link.label}
                </a>
              ))}
            </nav>
            <div className="mt-3 flex gap-2">
              {user ? (
                <Button as={Link} to="/app" className="flex-1">
                  Open dashboard
                </Button>
              ) : (
                <>
                  <Button as={Link} to="/login" variant="secondary" className="flex-1">
                    Sign in
                  </Button>
                  <Button as={Link} to="/register" className="flex-1">
                    Get started
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </header>
      <Outlet />
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-center gap-2">
            <BrandMark size={24} />
            <span>Research Funding &amp; Innovation Intelligence Platform · Capstone project</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <a href="/docs" className="hover:text-slate-800" target="_blank" rel="noreferrer">
              API docs
            </a>
            <a href="#transparency" className="hover:text-slate-800">
              Data sources
            </a>
            <Link to="/login" className="hover:text-slate-800">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
