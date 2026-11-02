import clsx from 'clsx'

/** Underlined tab bar. tabs: [{ key, label, icon?, count? }] */
export function Tabs({ tabs = [], value, onChange, className }) {
  return (
    <div className={clsx('border-b border-slate-200', className)}>
      <nav className="-mb-px flex gap-1 overflow-x-auto scrollbar-thin" role="tablist">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const selected = tab.key === value
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(tab.key)}
              className={clsx(
                'inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                selected
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700',
              )}
            >
              {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
              {tab.label}
              {tab.count !== undefined && tab.count !== null && (
                <span
                  className={clsx(
                    'rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular',
                    selected ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600',
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}

/** Compact segmented control. options: [{ value, label, icon? }] */
export function SegmentedControl({ options = [], value, onChange, size = 'sm', className, ariaLabel }) {
  return (
    <div className={clsx('inline-flex rounded-lg bg-slate-100 p-0.5', className)} role="radiogroup" aria-label={ariaLabel}>
      {options.map((option) => {
        const Icon = option.icon
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.title || (typeof option.label === 'string' ? option.label : undefined)}
            onClick={() => onChange(option.value)}
            className={clsx(
              'inline-flex items-center gap-1.5 rounded-md font-medium transition-colors',
              size === 'xs' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
              selected ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export default Tabs
