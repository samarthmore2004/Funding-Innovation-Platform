import { clamp, formatScore } from '../../utils/format'
import { METER } from '../charts/palette'

/**
 * Semicircular meter for a 0–100 score. The track is a lighter step of the fill's own
 * ramp so the state reads across the whole arc; the number is the hero figure.
 */
export default function ScoreGauge({ value, size = 180, label = 'Innovation score', sublabel, showValue = true }) {
  const hasValue = value !== null && value !== undefined && !Number.isNaN(Number(value))
  const v = hasValue ? clamp(value, 0, 100) : 0
  const stroke = Math.max(10, Math.round(size / 14))
  const radius = (size - stroke) / 2
  const cy = size / 2
  const length = Math.PI * radius
  const arc = `M ${stroke / 2} ${cy} A ${radius} ${radius} 0 0 1 ${size - stroke / 2} ${cy}`
  return (
    <figure className="flex flex-col items-center" aria-label={`${label || 'Score'}: ${hasValue ? `${formatScore(v)} out of 100` : 'not scored'}`}>
      <div className="relative" style={{ width: size, height: size / 2 + stroke / 2 }}>
        <svg width={size} height={size / 2 + stroke / 2} viewBox={`0 0 ${size} ${size / 2 + stroke / 2}`} aria-hidden="true">
          <path d={arc} fill="none" stroke={METER.track} strokeWidth={stroke} strokeLinecap="round" />
          {hasValue && v > 0 && (
            <path
              d={arc}
              fill="none"
              stroke={METER.fill}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${(length * v) / 100} ${length}`}
            />
          )}
        </svg>
        {showValue && (
          <div className="absolute inset-x-0 bottom-0 text-center">
            <span className="font-semibold text-slate-900" style={{ fontSize: Math.round(size / 4.2), lineHeight: 1 }}>
              {hasValue ? formatScore(v) : '—'}
            </span>
            <span className="ml-0.5 text-xs text-slate-500">/100</span>
          </div>
        )}
      </div>
      {(label || sublabel) && (
        <figcaption className="mt-2 text-center">
          {label && <span className="block text-xs font-medium text-slate-500">{label}</span>}
          {sublabel && <span className="block text-sm font-semibold text-slate-800">{sublabel}</span>}
        </figcaption>
      )}
    </figure>
  )
}
