import { useId } from 'react'
import clsx from 'clsx'

const CONTROL =
  'block rounded-lg border-0 bg-white px-3 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500'

/**
 * Default width/height unless the caller sets its own (`w-40`, `h-8`, …): two utilities for the
 * same property in one class list have no guaranteed winner, so the default is dropped instead.
 */
function sized(className, height = 'h-10') {
  const hasWidth = /(^|\s)(w-|min-w-|max-w-|flex-1)/.test(className || '')
  const hasHeight = /(^|\s)h-/.test(className || '')
  return clsx(!hasWidth && 'w-full', height && !hasHeight && height)
}

/** Label + hint + error wrapper. `children` may be a render function receiving the generated id. */
export function Field({ label, hint, error, required, className, children, id: providedId, labelAction }) {
  const generated = useId()
  const id = providedId || generated
  return (
    <div className={clsx('space-y-1.5', className)}>
      {label && (
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={id} className="block text-sm font-medium text-slate-700">
            {label}
            {required && <span className="ml-0.5 text-rose-500">*</span>}
          </label>
          {labelAction}
        </div>
      )}
      {typeof children === 'function' ? children(id) : children}
      {error ? (
        <p className="text-xs text-rose-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}

export function Input({ className, invalid, icon: Icon, ref, ...props }) {
  if (Icon) {
    return (
      <div className={clsx('relative', className)}>
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input ref={ref} className={clsx(CONTROL, 'h-10 w-full pl-9', invalid && 'ring-rose-400')} {...props} />
      </div>
    )
  }
  return <input ref={ref} className={clsx(CONTROL, sized(className), invalid && 'ring-rose-400', className)} {...props} />
}

export function Textarea({ className, rows = 4, invalid, ...props }) {
  return <textarea rows={rows} className={clsx(CONTROL, sized(className, null), 'py-2', invalid && 'ring-rose-400', className)} {...props} />
}

/** Native select. `options` = [{value, label, count?}]. */
export function Select({ options = [], placeholder, className, showCounts = false, ...props }) {
  return (
    <select className={clsx(CONTROL, sized(className), 'pr-8', className)} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((option) => (
        <option key={option.value} value={option.value} disabled={option.disabled}>
          {option.label}
          {showCounts && option.count !== undefined ? ` (${option.count})` : ''}
        </option>
      ))}
    </select>
  )
}

export function Checkbox({ label, description, className, id: providedId, ...props }) {
  const generated = useId()
  const id = providedId || generated
  return (
    <div className={clsx('flex items-start gap-2.5', className)}>
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 accent-indigo-600 focus:ring-indigo-500"
        {...props}
      />
      {(label || description) && (
        <label htmlFor={id} className="text-sm">
          <span className="font-medium text-slate-700">{label}</span>
          {description && <span className="block text-xs text-slate-500">{description}</span>}
        </label>
      )}
    </div>
  )
}

/** Accessible switch built on a button with role="switch". */
export function Toggle({ checked, onChange, label, description, disabled, className }) {
  const id = useId()
  return (
    <div className={clsx('flex items-center justify-between gap-4', className)}>
      {(label || description) && (
        <div>
          <span id={`${id}-label`} className="block text-sm font-medium text-slate-700">
            {label}
          </span>
          {description && <span className="block text-xs text-slate-500">{description}</span>}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={Boolean(checked)}
        aria-labelledby={label ? `${id}-label` : undefined}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={clsx(
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50',
          checked ? 'bg-indigo-600' : 'bg-slate-300',
        )}
      >
        <span
          className={clsx(
            'pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5.5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  )
}

export default Input
