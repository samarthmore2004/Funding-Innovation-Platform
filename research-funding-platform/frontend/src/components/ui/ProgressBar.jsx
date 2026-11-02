import clsx from 'clsx'
import { clamp, formatScore } from '../../utils/format'
import { METER } from '../charts/palette'

/** Linear meter (0–100). Track uses a lighter step of the fill's ramp. */
export default function ProgressBar({
  value,
  max = 100,
  label,
  showValue = true,
  valueText,
  size = 'md',
  color = METER.fill,
  track = METER.track,
  className,
}) {
  const hasValue = value !== null && value !== undefined && !Number.isNaN(Number(value))
  const pct = hasValue ? clamp((Number(value) / max) * 100, 0, 100) : 0
  return (
    <div className={clsx('w-full', className)}>
      {(label || showValue) && (
        <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
          {label && <span className="truncate font-medium text-slate-600">{label}</span>}
          {showValue && (
            <span className="ml-auto font-semibold text-slate-900 tabular">
              {valueText ?? (hasValue ? formatScore(value, max === 100 ? 1 : 0) : '—')}
            </span>
          )}
        </div>
      )}
      <div
        className={clsx('w-full overflow-hidden rounded-full', size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2')}
        style={{ background: track }}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={hasValue ? Number(value) : undefined}
        aria-label={typeof label === 'string' ? label : undefined}
      >
        <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}
