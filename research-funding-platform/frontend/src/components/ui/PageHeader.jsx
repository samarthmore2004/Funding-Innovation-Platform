import clsx from 'clsx'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useDocumentTitle } from '../../utils/hooks'

/** Page title row with optional breadcrumbs, description and actions. Also sets document.title. */
export default function PageHeader({ title, description, actions, breadcrumbs, className, icon: Icon }) {
  useDocumentTitle(typeof title === 'string' ? title : undefined)
  return (
    <div className={clsx('mb-6', className)}>
      {breadcrumbs?.length > 0 && (
        <nav className="mb-2 flex flex-wrap items-center gap-1 text-xs text-slate-500" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="inline-flex items-center gap-1">
              {index > 0 && <ChevronRight className="h-3 w-3" aria-hidden="true" />}
              {crumb.to ? (
                <Link to={crumb.to} className="hover:text-indigo-600">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-slate-700">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className="mt-0.5 hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm sm:flex">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
            {description && <p className="mt-1 max-w-3xl text-sm text-slate-500">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
