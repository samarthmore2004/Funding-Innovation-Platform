import clsx from 'clsx'

const TONES = {
  indigo: 'bg-indigo-50 text-indigo-600',
  violet: 'bg-violet-50 text-violet-600',
  sky: 'bg-sky-50 text-sky-600',
  green: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  slate: 'bg-slate-100 text-slate-600',
}

/** Stat tile: sentence-case label, proportional-figure value, optional hint. */
export default function StatCard({ label, value, hint, icon: Icon, tone = 'indigo', className, onClick }) {
  const Component = onClick ? 'button' : 'div'
  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={clsx(
        'flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm',
        onClick && 'transition hover:border-indigo-200 hover:shadow',
        className,
      )}
    >
      {Icon && (
        <span className={clsx('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', TONES[tone] || TONES.indigo)}>
          <Icon className="h-4.5 w-4.5" aria-hidden="true" />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-500">{label}</p>
        <p className="mt-1 truncate text-2xl font-semibold text-slate-900" title={typeof value === 'string' ? value : undefined}>
          {value ?? '—'}
        </p>
        {hint && <p className="mt-0.5 truncate text-xs text-slate-500" title={typeof hint === 'string' ? hint : undefined}>{hint}</p>}
      </div>
    </Component>
  )
}
