import clsx from 'clsx'

export function Card({ as: Component = 'div', className, children, padded = false, ...props }) {
  return (
    <Component
      className={clsx('rounded-xl border border-slate-200 bg-white shadow-sm', padded && 'p-5', className)}
      {...props}
    >
      {children}
    </Component>
  )
}

export function CardHeader({ title, subtitle, icon: Icon, actions, className }) {
  return (
    <div className={clsx('flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function CardBody({ className, children }) {
  return <div className={clsx('px-5 py-4', className)}>{children}</div>
}

export default Card
