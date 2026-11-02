import clsx from 'clsx'
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'

const VARIANTS = {
  info: { icon: Info, className: 'bg-indigo-50 text-indigo-900 ring-indigo-200', iconClass: 'text-indigo-500' },
  success: { icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-900 ring-emerald-200', iconClass: 'text-emerald-600' },
  warning: { icon: TriangleAlert, className: 'bg-amber-50 text-amber-900 ring-amber-200', iconClass: 'text-amber-600' },
  error: { icon: AlertCircle, className: 'bg-rose-50 text-rose-900 ring-rose-200', iconClass: 'text-rose-600' },
  neutral: { icon: Info, className: 'bg-slate-50 text-slate-700 ring-slate-200', iconClass: 'text-slate-500' },
}

/** Inline callout; status meaning always carries an icon + text, never color alone. */
export default function Alert({ variant = 'info', title, children, icon, action, className }) {
  const style = VARIANTS[variant] || VARIANTS.info
  const Icon = icon || style.icon
  return (
    <div
      role={variant === 'error' ? 'alert' : undefined}
      className={clsx('flex gap-3 rounded-xl px-4 py-3 text-sm ring-1 ring-inset', style.className, className)}
    >
      <Icon className={clsx('mt-0.5 h-4.5 w-4.5 shrink-0', style.iconClass)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={clsx(title && 'mt-0.5', 'opacity-90')}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  )
}
